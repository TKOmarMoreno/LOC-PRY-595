/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 * @NAmdConfig /SuiteScripts/configuration_l595.json
 */
define(['N/currentRecord', 'N/format', 'L595/utilidades', 'N/runtime', 'N/https', 'N/url', 'N/log', 'N/record', 'N/search', 'N/error', 'N/ui/dialog', 'N/translation'],
    function (currentRecord, format, utilities, runtime, https, url, log, record, search, error, dialog, translation) {

        const requestHandler = (context) => {
            let FN = "requestHandler";
            try {
                let valorSeleccionado = "inutilizar"; // Valor por defecto
                var htmlContent = '<div style="padding: 20px;">' +
                    '  <p>Seleccione una opción:</p>' +
                    '  <select id="l595_proceso_transaccion" class="input" style="width: 100%; padding: 5px; margin-bottom: 20px;">' +
                    '    <option value="inutilizar">Inutilizar Transacción</option>' +
                    '    <option value="cancelar">Cancelar Transacción</option>' +
                    '    <option value="ninguno">Regresar</option>' +
                    '  </select>' +
                    '</div>';

                document.addEventListener('change', function (e) {
                    if (e.target && e.target.id === 'l595_proceso_transaccion') {
                        valorSeleccionado = e.target.value;
                    }
                });

                dialog.create({
                    title: "Seleccione el evento que desea ejecutar.",
                    message: htmlContent,
                    buttons: [
                        { label: 'Confirmar', value: 'confirmar' },
                        { label: 'Cerrar', value: 'cancelar' }
                    ]
                }).then(function (result) {
                    if (result === 'confirmar') {

                        log.debug(FN, `Opción seleccionada: ${valorSeleccionado}`);
                        log.debug(FN, valorSeleccionado)
                        console.log(valorSeleccionado);
                        if (valorSeleccionado === 'inutilizar') {
                            inutilizarTransaccion();
                        } else if (valorSeleccionado === 'cancelar') {
                            cancelTransaction();
                        } else if (valorSeleccionado === 'ninguno') {
                            // log.debug(FN, 'El usuario ha decidido regresar sin realizar ninguna acción.');
                        }
                    }
                });
            } catch (error) {
                log.error({
                    title: FN,
                    details: error
                })
            }
        }

        const inutilizarTransaccion = () => {
            let FN = "inutilizarTransaccion";
            try {
                log.debug(FN, 'Función de inutilización de transacción');
                let motivo = "";

                var htmlContent = '<div style="padding: 20px;">' +
                    '  <p>Ingrese el motivo de inutilización:</p>' +
                    '  <input type="text" id="l595_motivo_inutilizacion" style="width: 100%; padding: 5px;" />' +
                    '</div>'
                document.addEventListener('input', function (e) {
                    if (e.target && e.target.id === 'l595_motivo_inutilizacion') {
                        motivo = e.target.value;
                    }
                });

                dialog.create({
                    title: "Proceso de Inutilización de Transacción",
                    message: htmlContent,
                    buttons: [
                        { label: 'Aceptar', value: 'yes' },
                        { label: 'Cancelar', value: 'no' }
                    ]
                }).then(function (result) {
                    if (result === 'yes') {
                        console.log("El usuario escribió: " + motivo);
                        // Aquí ejecutas tu lógica con motivo
                    } else {
                        alert('Proceso de inutilización cancelado por el usuario.');
                    }
                });
            } catch (error) {
                log.error({
                    title: FN,
                    details: error
                })
            }
        }

        function cancelTransaction() {
            const process = 'cancelTransaction';
            var motivo = prompt('Por favor ingresa el motivo de cancelación:');

            if (motivo) {

                if (motivo.length < 5 || motivo.length > 500) {
                    dialog.alert({
                        title: 'Motivo inválido',
                        message: 'El motivo de cancelación debe tener entre 5 y 500 caracteres.'
                    });
                    return false;
                }

                var currentContext = currentRecord.get();  // Obtiene el registro actual (transacción)
                const recId = currentContext.id;
                const recType = currentContext.type;

                const new_url = url.resolveScript({
                    scriptId: 'customscript_l595_cancel_transaccion_st',
                    deploymentId: 'customdeploy_l595_cancel_transaccion_st',
                });

                const parametros = JSON.parse(currentContext.getValue({ fieldId: 'custpage_l595_parametros_boton' }));

                const { codEstadoCancelado, codigoEstadoError, codigoEstadoSinError, username, password, urlService, cdc } = parametros;

                const postData = {
                    motivo: motivo,
                    username: username,
                    password: password,
                    urlService: urlService,
                    CDC: cdc
                };

                const response = https.post({
                    url: new_url,
                    body: postData
                });

                if (utilities.isEmpty(response) || utilities.isEmpty(response.body)) {
                    const mensaje = 'Error obteniendo información de Suitelet cancelación - Respuesta vacía.';
                    logErrorYNotificar(process, mensaje, codigoEstadoError, recId);
                    return false;
                }
                const informacionRespuestaAux = JSON.parse(response.body);
                console.log('Cancelar Transaccion: informacionRespuestaAux', informacionRespuestaAux);

                if (!informacionRespuestaAux) {
                    const mensaje = 'Error obteniendo información de Suitelet cancelación - Respuesta body: nula/vacía';
                    logErrorYNotificar(process, mensaje, codigoEstadoError, recId);
                    return false;
                } else if (!informacionRespuestaAux.success) {
                    var mensaje = 'Error en el proceso de cancelación - Detalles: ' + informacionRespuestaAux.message
                    log.error(process, mensaje);
                    logErrorYNotificar(process, mensaje, codigoEstadoError, recId);
                    return false;
                }

                if (informacionRespuestaAux.cancelado) {
                    record.submitFields({
                        type: recType,
                        id: recId,
                        values: {

                            custbody_l595_fe_fecha_cancelacion: new Date(informacionRespuestaAux.FECHA),
                            custbody_l595_fe_motivo_cancelacion: motivo,
                            custbody_l595_estado_comp_elec: informacionRespuestaAux.estadoTransaction
                        },
                        options: {
                            enablesourcing: false,
                            ignoreMandatoryFields: true
                        }
                    });
                }

                // Comprobar si la transacción fue rechazada o tiene un estado no válido
                if (informacionRespuestaAux.estadoCodFE != codEstadoCancelado) {
                    const mensajeFinal = `Error en el proceso de generación de cancelación - Detalles: ${informacionRespuestaAux.estadoCodFE} - ${informacionRespuestaAux.message}`;
                    grabarError(codigoEstadoError, mensajeFinal, null, recId);
                } else if (informacionRespuestaAux.estadoCodFE == codEstadoCancelado) {
                    const mensajeFinal = `Se ha generado correctamente la cancelación para la transacción.`;
                    grabarError(codigoEstadoSinError, mensajeFinal, null, recId);
                }
                window.location.reload();
            } else {
                log.debug('El motivo de cancelación no fue ingresado');
            }
        }

        function logErrorYNotificar(process, mensaje, codigoEstadoError, recId) {
            log.error({ title: process, details: `Error: ${mensaje} ` });
            grabarError(codigoEstadoError, mensaje, null, recId, null);
            dialog.alert({ title: 'Error', message: mensaje });
        }

        const grabarError = (codigoEstado, detalleMensaje, refLog, refTransaccion, idXMLFE) => {
            const proceso = 'grabarError';
            log.debug(proceso, `INICIO PROCESO - grabarError - parámetros - codigoEstado: ${codigoEstado} - detalleMensaje: ${detalleMensaje} - refLog: ${refLog} - refTransaccion: ${refTransaccion} - idXMLFE: ${idXMLFE}`);

            try {
                if (utilities.isEmpty(refLog)) {
                    const recordLog = record.create({ type: 'customrecord_l595_traza_audit_fe', isDynamic: true });
                    const fechaActual = format.parse({
                        value: new Date(),
                        type: format.Type.DATE,
                        timezone: format.Timezone.AMERICA_ASUNCION
                    });

                    recordLog.setValue({ fieldId: 'custrecord_l595_traza_audit_fe_fecha', value: fechaActual });

                    if (!utilities.isEmpty(codigoEstado)) {
                        recordLog.setValue({ fieldId: 'custrecord_l595_traza_audit_fe_estado', value: codigoEstado });
                    }

                    const subL = 'recmachcustrecord_l595_traza_audit_fe_det_trz';
                    recordLog.selectNewLine({ sublistId: subL });
                    recordLog.setCurrentSublistValue({ sublistId: subL, fieldId: 'custrecord_l595_traza_audit_fe_det_fch', value: fechaActual });

                    const detalles = {
                        'custrecord_l595_traza_audit_fe_det_msj': detalleMensaje,
                        'custrecord_l595_traza_audit_fe_det_ref': refTransaccion,
                        'custrecord_l595_traza_audit_fe_det_doc': idXMLFE
                    };

                    for (const fieldId in detalles) {
                        if (!utilities.isEmpty(detalles[fieldId])) {
                            recordLog.setCurrentSublistValue({ sublistId: subL, fieldId: fieldId, value: detalles[fieldId] });
                        }
                    }

                    recordLog.commitLine({ sublistId: subL });
                    recordLog.save();
                }

                log.debug(proceso, `id log FE: ${refLog}`);

            } catch (error) {
                log.error(proceso, `Excepción Grabando Log de Proceso de Factura Electrónica - Excepción: ${error.message}`);
            }

            log.debug(proceso, 'FIN PROCESO - grabarError.');
        };

        return {
            requestHandler
        };
    });
