(function(){
  'use strict';
  const M=window.TPFModules;
  if(!M||window.__tpfSalesListInlineDateLoaded)return;
  window.__tpfSalesListInlineDateLoaded=true;

  const pad=value=>String(value).padStart(2,'0');
  const display=iso=>{
    const raw=String(iso||'').slice(0,10);
    const match=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match?`${match[3]}/${match[2]}/${match[1]}`:'';
  };
  const parse=value=>{
    const raw=String(value||'').trim();
    if(!raw)return {iso:''};
    let day,month,year;
    let match=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if(match){[,day,month,year]=match;}
    else{
      match=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if(!match)return {error:'Escribe la fecha como dd/mm/aaaa.'};
      [,year,month,day]=match;
    }
    const date=new Date(Number(year),Number(month)-1,Number(day));
    if(date.getFullYear()!==Number(year)||date.getMonth()!==Number(month)-1||date.getDate()!==Number(day)){
      return {error:'La fecha no es válida.'};
    }
    return {iso:`${year}-${pad(month)}-${pad(day)}`};
  };
  const patchCache=(id,expectedDate)=>{
    try{
      const row=(window.salesCache?.opportunities||[]).find(item=>String(item.id)===String(id));
      if(row)row.expected_date=expectedDate||null;
    }catch(_){}
  };
  const save=async input=>{
    if(!input||input.dataset.saving==='1')return;
    const id=String(input.dataset.oppId||'');
    if(!id)return;
    const result=parse(input.value);
    if(result.error){
      input.value=display(input.dataset.originalDate);
      input.setCustomValidity(result.error);
      input.reportValidity?.();
      input.setCustomValidity('');
      return;
    }
    const previous=String(input.dataset.originalDate||'').slice(0,10);
    if(result.iso===previous){input.value=display(previous);return;}
    input.dataset.saving='1';
    input.disabled=true;
    try{
      const response=await sb.from('sales_opportunities').update({expected_date:result.iso||null}).eq('id',id);
      if(response.error)throw response.error;
      input.dataset.originalDate=result.iso;
      input.value=display(result.iso);
      patchCache(id,result.iso);
      window.dispatchEvent(new CustomEvent('tpf:sales-updated',{detail:{id,expectedDate:result.iso||null,source:'list-date'}}));
    }catch(error){
      input.value=display(previous);
      alert(error?.message||'No se pudo guardar la fecha.');
    }finally{
      input.disabled=false;
      delete input.dataset.saving;
    }
  };
  const install=()=>{
    document.addEventListener('pointerdown',event=>{
      if(!event.target.closest?.('#salesListRows .salesListDateInput'))return;
      event.stopPropagation();
    },true);
    document.addEventListener('click',event=>{
      if(!event.target.closest?.('#salesListRows .salesListDateInput'))return;
      event.stopPropagation();
    },true);
    document.addEventListener('change',event=>{
      const input=event.target.closest?.('#salesListRows .salesListDateInput');
      if(!input)return;
      event.stopPropagation();
      save(input);
    },true);
    document.addEventListener('keydown',event=>{
      const input=event.target.closest?.('#salesListRows .salesListDateInput');
      if(!input)return;
      if(event.key==='Escape'){
        event.preventDefault();
        input.value=display(input.dataset.originalDate);
        input.blur();
      }
      if(event.key==='Enter'){
        event.preventDefault();
        event.stopPropagation();
        save(input);
      }
    },true);
  };
  M.register('sales-list-inline-date',{install});
})();
