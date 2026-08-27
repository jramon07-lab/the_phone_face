(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const mark='data-tpf-source-ui';

  function setDefault(input,value){
    if(!input||String(input.value||'').trim()!=='') return;
    input.value=value;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function addSource(label,text,kind='contact'){
    if(!label||label.querySelector('['+mark+']')) return;
    const d=document.createElement('div');
    d.setAttribute(mark,'1');
    d.className='tpfDataSource '+(kind==='date'?'tpfDateSource':'');
    d.innerHTML='<span class="tpfDataSourceIcon">'+(kind==='date'?'◷':'↳')+'</span><span>'+text+'</span>';
    label.appendChild(d);
  }

  function decorateField(root,key,def,text,kind){
    const input=$('[data-cfg="'+key+'"]',root);if(!input)return;
    setDefault(input,def);
    addSource(input.closest('label'),text,kind);
  }

  function decorateDatePair(root,valueKey,unitKey){
    const v=$('[data-cfg="'+valueKey+'"]',root),u=$('[data-cfg="'+unitKey+'"]',root);
    if(v) setDefault(v,'0');
    if(u && !u.value){u.value='days';u.dispatchEvent(new Event('change',{bubbles:true}));}
    addSource(v?.closest('label'),'Fecha base: asignación de la etiqueta','date');
    addSource(u?.closest('label'),'0 = mismo día de la etiqueta','date');
  }

  function installStyles(){
    if(document.getElementById('tpfContactSourceStyles'))return;
    const s=document.createElement('style');s.id='tpfContactSourceStyles';s.textContent=`
      .tpfDataSource{display:flex;align-items:center;gap:5px;margin-top:5px;padding:5px 7px;border:1px solid #cfe1f7;border-radius:7px;background:#f5f9ff;color:#315b95;font-size:9px;font-weight:700;line-height:1.2}
      .tpfDataSourceIcon{font-size:11px}.tpfDateSource{border-color:#ead8ae;background:#fffaf0;color:#805b12}
      #tpfStepEditor [data-cfg="client_name"],#tpfStepEditor [data-cfg="phone"],#tpfStepEditor [data-cfg="customer_name"],#tpfStepEditor [data-cfg="customer_phone"]{background:#fbfdff}
    `;document.head.appendChild(s);
  }

  function decorate(){
    const root=document.getElementById('tpfStepEditor');if(!root)return;
    installStyles();
    const action=$('[data-key="action_type"]',root)?.value||'';
    if(action==='create_opportunity'){
      decorateField(root,'client_name','{nombre}','Origen: contacto que recibió la etiqueta → Nombre');
      decorateField(root,'phone','{telefono}','Origen: contacto que recibió la etiqueta → Teléfono');
      decorateDatePair(root,'expected_value','expected_unit');
    }
    if(action==='create_task'){
      decorateField(root,'customer_name','{nombre}','Origen: contacto que recibió la etiqueta → Nombre');
      decorateField(root,'customer_phone','{telefono}','Origen: contacto que recibió la etiqueta → Teléfono');
      decorateDatePair(root,'start_value','start_unit');
    }
  }

  function start(){
    decorate();
    const target=document.getElementById('view-automations')||document.body;
    new MutationObserver(()=>decorate()).observe(target,{childList:true,subtree:true});
    document.addEventListener('change',e=>{if(e.target?.matches?.('[data-key="action_type"]'))setTimeout(decorate,0);});
    document.addEventListener('click',e=>{if(e.target?.closest?.('.nav[data-view="automations"],.tpfFlowStep,[data-add]'))setTimeout(decorate,80);});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
