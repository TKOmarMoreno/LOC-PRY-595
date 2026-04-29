/**
 * @format
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope Public
 */

define(['N/format', 'N/runtime', 'N/http'],
	function (format, runtime, http) {
	const onRequest = (context) => {
		let process = 'onRequest';
		let script = runtime.getCurrentScript();
		try {
			if (context.request.method == 'POST') {
				log.debug(process, 'Remaining Usage = ' + script.getRemainingUsage() + ' --- time: ' + new Date());
				let resultados = send(context);
				context.response.writeLine(JSON.stringify(resultados));
			}

		} catch (error) {
			message = 'Ha ocurrido una excepción en el Suitelet de Generación del Nº de autorización. Detalles: ' + error.message;
			log.error(process, message);
		}
	}
    const obtenerToken = (username, password, entorno) => {
        try {
            const tokenRequestBody = `username=${username}&password=${password}&grant_type=password`;
            const tokenRequestHeaders = {
                'Content-Type': 'application/x-www-form-urlencoded'
            };
    
            const tokenResponse = http.post({
                url: `${entorno}/Token`,
                body: tokenRequestBody,
                headers: tokenRequestHeaders
            });
    
            if (tokenResponse.code === 200) {
                const tokenData = JSON.parse(tokenResponse.body);
                const accessToken = tokenData.access_token;
                log.debug('Token Obtenido Exitosamente', accessToken);
                return accessToken;
            } else {
                log.error('Error al Obtener Token', `Código: ${tokenResponse.code} - Detalle: ${tokenResponse.body}`);
                return null;
            }
        } catch (error) {
            log.error('Error en Solicitud de Token', error.message);
            return null;
        }
    };

    const send = (context) => {
        const process = 'send';
        const { request } = context;
        const { parameters } = request
        const { motivo, username, password, urlService,CDC } = parameters;
        const currentScript = runtime.getCurrentScript();
        const estadoCancelado = currentScript.getParameter('custscript_l595_estado_cancelado');
        const estadoAprobado = currentScript.getParameter('custscript_l595_estado_aprobado');
        const codigoEstadoCancelado = currentScript.getParameter('custscript_l595_cod_estado_cancelado');
        let result = {
            success: true,
            message: 'Success!',
            FECHA: '',
            estadoCodFE: '',
            estadoTransaction: ''         
        };
        const tokenService = obtenerToken(username, password, urlService);

        log.debug(process, 'tokenService: ' + tokenService);
        if (!tokenService) {
            result = {
                success: false,
                message: 'No se pudo obtener el token de autenticación',
            };
            log.error(process, result.message);
            return result;
        }

        const fechaParaguay = getParaguayTime()
        log.debug('fechaParaguay',fechaParaguay);

        const JSONCancelacion = JSON.stringify({
            "eventDetails": [
                {
                    "typeCode": 1, 
                    "reason": motivo,
                    "documentId": CDC,
                    "signDate": fechaParaguay // Fecha actual en zona horaria de Paraguay
                }
            ]
        });
        // Preparar los encabezados para la solicitud
        const requestHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenService}`,
        };
        log.debug('body',JSONCancelacion);
        const wsResponse = http.post({
            url: `${urlService}/api/electronicDocument/event`,
            body: JSONCancelacion,
            headers: requestHeaders,
        });
        if (wsResponse.code === 200) {
            // Parsear la respuesta del servicio
            const responseBody = JSON.parse(wsResponse.body);
            
            log.debug('Respuesta del servicio Body:', responseBody);
            const resultBody = JSON.parse(responseBody.SifenJsonResult);

            log.debug('Respuesta del servicio Sifen:', resultBody);

            const fechaProcesamiento = resultBody.Body.rRetEnviEventoDe.dFecProc;
            const codigoEstado = resultBody.Body.rRetEnviEventoDe.gResProcEVe.gResProc.dCodRes;
            const mensajeEstado = resultBody.Body.rRetEnviEventoDe.gResProcEVe.gResProc.dMsgRes;

            // Actualizar el objeto result con la respuesta procesada
            result = {
                success: true,
                message: mensajeEstado,
                FECHA: convertToNetSuiteDateTime(fechaProcesamiento),
                estadoCodFE: codigoEstado,
                estadoTransaction: codigoEstado == codigoEstadoCancelado? estadoCancelado : estadoAprobado,
                cancelado: codigoEstado == codigoEstadoCancelado? true : false
            }; 
            
        } else {
            log.error('Error en la solicitud al servicio', `Código: ${wsResponse.code} - Detalle: ${wsResponse.body}`);
            result = {
                success: false,
                message: `Error en la solicitud: ${wsResponse.body}`,
            };
        }
        log.debug('result',result);
        return result;
    }

    const getParaguayTime = () => {
        const now = new Date();
        log.debug('now',now)
        // Definir fechas aproximadas de inicio y fin del horario de verano en Paraguay
        const DST_START = new Date(now.getFullYear(), 9, 1); // Primer domingo de octubre (aproximado)
        const DST_END = new Date(now.getFullYear(), 2, 25); // Último domingo de marzo (aproximado)

        // Ajustar las fechas al primer y último domingo del mes
        DST_START.setDate(DST_START.getDate() + (7 - DST_START.getDay()) % 7);
        DST_END.setDate(DST_END.getDate() - DST_END.getDay());

        // Verificar si estamos en horario de verano
        const isDST = now >= DST_START && now < DST_END;

        // UTC-3 en horario de verano, UTC-4 en horario estándar
        const paraguayOffset = isDST ? -3 * 60 : -4 * 60;
        const paraguayTime = new Date(now.getTime() + paraguayOffset * 60000);

        return paraguayTime.toISOString(); // Convertir a formato ISO
    };

    const convertToNetSuiteDateTime =  (dateTimeString) => {
        try {
            
            log.debug('Fecha Proveedor', dateTimeString);
            // Parsear el string en un objeto Date estándar de JavaScript
            const jsDate = new Date(dateTimeString);

            // Verificar si la fecha es válida
            if (isNaN(jsDate)) {
                throw new Error("Fecha inválida");
            }

            // Convertir el objeto Date al formato de NetSuite Date/Time
            const nsDateTime = format.parse({
                value: jsDate,
                type: format.Type.DATETIME,
            });
            
            log.debug('Fecha NetSuite', nsDateTime);

            return nsDateTime

        } catch (error) {
            log.error('Error al convertir fecha', error.message);
        }
    };
    return {
        onRequest: onRequest
    };
});