(function(){
  'use strict';
  const M=window.TPFModules;if(!M)return;
  M.register('whatsapp-scheduling',{install(){
    const ok=typeof window.openWhatsappProgramsView==='function'||document.getElementById('waQuickModal');
    if(!ok)throw new Error('Programación WhatsApp no disponible');
  }});
  M.register('automations-flow',{install(){
    const ready=window.TPFAutomationFlow&&typeof window.TPFAutomationFlow.newFlow==='function'&&typeof window.TPFAutomationFlow.editFlow==='function';
    if(!ready)throw new Error('Constructor de automatizaciones no disponible');
  }});
})();
