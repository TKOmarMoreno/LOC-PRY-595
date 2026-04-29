/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */
define(['N/ui/serverWidget'], (serverWidget) => {

    const beforeLoad = (context) => {
        if (context.type === context.UserEventType.VIEW) {
            const { newRecord, form} = context;
            const estadoFE = newRecord.getValue({ fieldId: 'custbody_l595_estado_comp_elec' });
            if (estadoFE == 1) {
            
                // Agregar botón personalizado
                form.addButton({
                    id: 'custpage_btn_cancelar',
                    label: 'Cancelar Transacción',
                    functionName: 'cancelTransaction' // Función del Client Script
                });

                // Asociar el Client Script al formulario
                form.clientScriptModulePath = './PRY - Cancelar Transaccion (CL).js'; 
            }
        }
    };

    return {
        beforeLoad
    };
});