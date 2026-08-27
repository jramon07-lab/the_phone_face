(function(){
  'use strict';
  const M=window.TPFModules;
  const btn=document.getElementById('searchBtn');
  if(!btn||btn.__tpfSearchFallbackInstalled)return;
  btn.__tpfSearchFallbackInstalled=true;
  if(M?.claimControl)M.claimControl('search-fallback','#searchBtn','fallback');

  const base=btn.onclick;
  function norm(v){return String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();}
  function digits(v){return String(v??'').replace(/\D/g,'');}
  function rowMatches(row,q){
    const nq=norm(q),dq=digits(q),d=row?.data||{};
    for(const value of Object.values(d)){
      const s=norm(value);
      if(nq&&s.includes(nq))return true;
      if(dq.length>=5&&digits(value).includes(dq))return true;
    }
    return false;
  }

  async function fallbackRows(q,sheet){
    const found=[];
    const pageSize=1000;
    const maxRows=50000;
    const source=sheet||null;
    for(let from=0;from<maxRows && found.length<100;from+=pageSize){
      let query=sb.from('records').select('id,source_sheet,source_row,data').order('id',{ascending:true}).range(from,from+pageSize-1);
      if(source)query=query.eq('source_sheet',source);
      const {data,error}=await query;
      if(error)throw error;
      const chunk=data||[];
      for(const row of chunk){if(rowMatches(row,q))found.push(row);if(found.length>=100)break;}
      if(chunk.length<pageSize)break;
    }
    return found;
  }

  btn.onclick=async function(){
    try{
      if(typeof base==='function')await base.call(this);
      const q=document.getElementById('searchText')?.value?.trim()||'';
      const sheet=document.getElementById('searchSheet')?.value||'';
      const visibleRows=sheet?document.querySelectorAll('#searchRows tr').length:document.querySelectorAll('#searchUnifiedRows tr').length;
      if(!q||visibleRows)return;
      const rows=await fallbackRows(q,sheet);
      if(!rows.length){M?.emit?.('search-fallback','ok','Fallback sin coincidencias');return;}
      if(sheet){
        document.getElementById('searchSingleResults')?.classList.remove('hidden');
        document.getElementById('searchUnifiedResults')?.classList.add('hidden');
        await renderSearchResults(rows);
      }else{
        document.getElementById('searchSingleResults')?.classList.add('hidden');
        document.getElementById('searchUnifiedResults')?.classList.remove('hidden');
        await renderUnifiedSearchResults(rows);
      }
      M?.emit?.('search-fallback','ok',`Fallback visible: ${rows.length} resultado(s)`);
    }catch(error){
      M?.report?.('search-fallback',error,'searchBtn');
    }
  };
})();