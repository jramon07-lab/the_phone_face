/* Acciones fiables de la vista Lista de oportunidades. */
(function(){
  function byId(id){return document.getElementById(id);}
  function setValue(id,value){
    const el=byId(id);
    if(el)el.value=value||"";
  }
  function openFromRow(row){
    if(!row)return;
    const d=row.dataset||{};
    if(typeof window.openOpportunityCard==='function'){
      return window.openOpportunityCard(d.oppId);
    }
    const modal=byId("oppDetailModal");
    if(!modal)return;
    setValue("oppModalId",d.oppId);
    setValue("oppModalTitle",d.oppTitle);
    setValue("oppModalClient",d.oppClient);
    setValue("oppModalPhone",d.oppPhone);
    setValue("oppModalAmount",d.oppAmount);
    setValue("oppModalDate",d.oppDate);
    setValue("oppModalNotes",d.oppNotes);
    const heading=byId("oppModalHeading");
    if(heading)heading.textContent=d.oppTitle||"Ficha de oportunidad";
    const contact=byId("oppModalOpenContact");
    if(contact)contact.dataset.recordId=d.oppRecordId||"";
    const stage=byId("oppModalStage");
    if(stage&&d.oppStage){
      for(let i=0;i<stage.options.length;i++){
        if(stage.options[i].value===d.oppStage){stage.value=d.oppStage;break;}
      }
    }
    const meta=byId("oppMetaInfo");
    if(meta)meta.textContent=d.oppStageName?"Columna actual: "+d.oppStageName:"";
    modal.classList.remove("hidden");
  }

  // Solo el título abre la ficha. Los controles de la fila no la abren.
  document.addEventListener("pointerdown",function(event){
    const target=event.target;
    if(!(target instanceof Element))return;
    const title=target.closest("#salesListRows .salesListTitle");
    if(!title)return;
    event.preventDefault();
    event.stopPropagation();
    openFromRow(title.closest(".salesListRow"));
  },true);

  function toIsoDate(text){
    const m=String(text||"").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(!m)return null;
    const day=Number(m[1]),month=Number(m[2]),year=Number(m[3]);
    const d=new Date(year,month-1,day);
    if(d.getFullYear()!==year||d.getMonth()!==month-1||d.getDate()!==day)return null;
    return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  }
  function displayDate(iso){
    const p=String(iso||"").split("-");
    return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:"";
  }
  async function saveDate(input){
    if(input.dataset.saving==="1")return;
    const previous=input.dataset.originalDate||"";
    const next=toIsoDate(input.value);
    if(!next){
      input.value=displayDate(previous);
      alert("Escribe la fecha como día/mes/año, por ejemplo 01/09/2026.");
      return;
    }
    if(next===previous){input.value=displayDate(previous);return;}
    input.dataset.saving="1";
    input.disabled=true;
    try{
      const {error}=await sb.from("sales_opportunities").update({expected_date:next}).eq("id",input.dataset.oppId);
      if(error)throw error;
      input.dataset.originalDate=next;
      input.value=displayDate(next);
      const row=input.closest(".salesListRow");
      if(row)row.dataset.oppDate=next;
    }catch(error){
      input.value=displayDate(previous);
      alert("No se pudo guardar la fecha: "+(error?.message||"error desconocido"));
    }finally{
      input.disabled=false;
      input.dataset.saving="";
    }
  }
  document.addEventListener("change",function(event){
    const input=event.target;
    if(!(input instanceof HTMLInputElement)||!input.matches("#salesListRows .salesListDateInput"))return;
    event.stopPropagation();
    saveDate(input);
  },true);
  document.addEventListener("keydown",function(event){
    const input=event.target;
    if(!(input instanceof HTMLInputElement)||!input.matches("#salesListRows .salesListDateInput"))return;
    if(event.key==="Enter"){event.preventDefault();event.stopPropagation();saveDate(input);}
    if(event.key==="Escape"){event.preventDefault();input.value=displayDate(input.dataset.originalDate||"");input.blur();}
  },true);
})();
