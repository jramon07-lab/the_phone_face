/* Apertura fiable de oportunidades desde la vista Lista.
   Se usa delegación de eventos porque las filas se generan dinámicamente. */
(function(){
  function byId(id){return document.getElementById(id);}
  function setValue(id,value){
    const el=byId(id);
    if(el)el.value=value||"";
  }
  function openFromRow(row){
    if(!row)return;
    const d=row.dataset||{};
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

  document.addEventListener("pointerdown",function(event){
    const target=event.target;
    if(!(target instanceof Element))return;
    const row=target.closest("#salesListRows .salesListRow");
    if(!row)return;
    if(target.closest(".salesListDate,input,select,button,a,label"))return;
    event.preventDefault();
    event.stopPropagation();
    openFromRow(row);
  },true);

  function formatDate(value){
    const parts=String(value||"").split("-");
    return parts.length===3?`${parts[2]}/${parts[1]}/${parts[0]}`:"—";
  }
  function restoreDate(cell,value){
    cell.dataset.date=value||"";
    cell.textContent=formatDate(value);
  }
  function editDate(cell){
    if(cell.querySelector("input"))return;
    const oldValue=cell.dataset.date||"";
    const input=document.createElement("input");
    input.type="date";
    input.value=oldValue;
    input.className="salesListDateInput";
    input.setAttribute("aria-label","Cambiar fecha de oportunidad");
    cell.replaceChildren(input);
    input.focus({preventScroll:true});
    try{input.showPicker?.();}catch(_){}

    input.addEventListener("keydown",event=>{
      if(event.key==="Escape"){event.preventDefault();restoreDate(cell,oldValue);}
    });
    input.addEventListener("change",async()=>{
      const nextValue=input.value||"";
      if(nextValue===oldValue){restoreDate(cell,oldValue);return;}
      input.disabled=true;
      try{
        const {error}=await sb.from("sales_opportunities").update({expected_date:nextValue||null}).eq("id",cell.dataset.oppId);
        if(error)throw error;
        const row=cell.closest(".salesListRow");
        if(row)row.dataset.oppDate=nextValue;
        restoreDate(cell,nextValue);
      }catch(error){
        restoreDate(cell,oldValue);
        alert("No se pudo guardar la fecha: "+(error?.message||"error desconocido"));
      }
    });
  }
  document.addEventListener("pointerdown",function(event){
    const target=event.target;
    if(!(target instanceof Element)||target.closest("input"))return;
    const cell=target.closest("#salesListRows .salesListDate");
    if(!cell)return;
    event.preventDefault();
    event.stopPropagation();
    editDate(cell);
  },true);
})();
