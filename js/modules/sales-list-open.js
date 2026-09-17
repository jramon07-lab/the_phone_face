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

  document.addEventListener("click",function(event){
    const target=event.target;
    if(!(target instanceof Element))return;
    const row=target.closest("#salesListRows .salesListRow");
    if(!row)return;
    if(target.closest("input,select,button,a,label"))return;
    event.preventDefault();
    event.stopPropagation();
    openFromRow(row);
  },true);
})();
