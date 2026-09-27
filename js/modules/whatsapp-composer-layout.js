/* Presentation only: move original controls, retaining native listeners. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const paths={attach:'M21 11.5l-8.5 8.5a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.8-2.8l8.5-8.5',reply:'M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5Z',more:'M5 12h.01M12 12h.01M19 12h.01',send:'m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13',clock:'M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',template:'M6 3h12v18H6zM9 8h6M9 12h6M9 16h4'};
function label(b,key,text){if(!b||b.dataset.cleanIcon)return;b.dataset.cleanIcon='1';b.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+paths[key]+'"/></svg>'+(text?'<span>'+text+'</span>':'');b.setAttribute('aria-label',text||'Enviar mensaje');}
function install(){
 const composer=$('waComposerText')?.closest('.waComposer');if(!composer||!$('waQuickRepliesBtn')||$('waComposerActions'))return;
 composer.classList.add('waOrganizedComposer');
 const bar=document.createElement('div');bar.id='waComposerActions';composer.append(bar);
 const more=document.createElement('details');more.id='waComposerMore';const summary=document.createElement('summary');label(summary,'more','Más');more.append(summary);
 const menu=document.createElement('div');menu.id='waComposerMoreMenu';more.append(menu);
 for(const [id,key,text] of [['waAttachBtn','attach','Adjuntar'],['waQuickRepliesBtn','reply','Respuestas'],['waTemplateBtn','template','Plantillas']]){label($(id),key,text);if($(id))bar.append($(id));}
 for(const [id,key,text] of [['waScheduleBtn','clock','Programar mensaje']]){label($(id),key,text);if($(id))menu.append($(id));}
 bar.append(more);label($('waComposerSend'),'send','');
 more.addEventListener('toggle',()=>{if(!more.open)return;const r=summary.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(r.right-230,innerWidth-238))+'px';menu.style.bottom=Math.max(8,innerHeight-r.top+6)+'px';});
 document.addEventListener('click',e=>{if(more.open&&(!more.contains(e.target)||e.target.closest('#waComposerMoreMenu button')))more.open=false;});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&more.open){more.open=false;summary.focus();}});
 window.addEventListener('resize',()=>more.open=false);
}
const style=document.createElement('style');style.textContent=`
#view-whatsapplive .waTabs{justify-content:flex-start!important;flex-wrap:wrap!important;overflow:visible!important;gap:4px!important;height:auto!important;flex-shrink:0!important}.waCleanFilters[hidden]{display:none!important}
#view-whatsapplive #waAutoReplySettings{margin-left:0!important;padding:8px 10px!important;border:1px solid #cbdcf4!important;border-radius:8px!important;color:#175cd3!important;background:white!important}
#view-whatsapplive .waOrganizedComposer{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important;padding:12px!important;align-items:center!important}
#view-whatsapplive .waOrganizedComposer .waComposerTextWrap{grid-column:1!important;grid-row:1!important;width:100%!important;min-width:0!important}
#view-whatsapplive .waOrganizedComposer #waComposerText{min-height:48px!important;font-size:14px!important;border:1px solid #cbd5e1!important;border-radius:8px!important;padding:12px!important}
#view-whatsapplive .waOrganizedComposer #waComposerSend{grid-column:2!important;grid-row:1!important;width:46px!important;height:46px!important;border-radius:9px!important;display:flex!important;align-items:center!important;justify-content:center!important;background:#16a765!important;color:white!important}
#waComposerActions{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px;min-width:0}
#view-whatsapplive #waComposerActions>button,#view-whatsapplive #waComposerMore>summary{display:flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;width:auto!important;flex:1 1 110px!important;height:40px!important;padding:7px 10px!important;font-size:14px!important;font-weight:600!important;background:#fff!important;color:#244568!important;border:1px solid #d6e1ee!important;border-radius:7px!important;cursor:pointer;box-sizing:border-box}
#waComposerMore{flex:1 1 100px;min-width:0}#waComposerMore>summary{list-style:none}#waComposerMore>summary::-webkit-details-marker{display:none}
#waComposerMoreMenu{position:fixed;z-index:10010;width:230px;padding:7px;background:white;border:1px solid #d6e1ee;border-radius:9px;box-shadow:0 8px 24px #20344f22}
#view-whatsapplive #waComposerMoreMenu>button{display:flex!important;gap:9px!important;align-items:center!important;width:100%!important;height:40px!important;padding:8px 10px!important;font-size:13px!important;text-align:left!important;background:white!important;border:0!important;color:#244568!important}
#waComposerMoreMenu>button:hover{background:#eff5ff!important}#waComposerActions svg{flex-shrink:0}
@media(min-width:1051px){body.tpfUnified #view-whatsapplive.waCleanWorkspace .waLiveLayout{grid-template-columns:clamp(250px,21vw,300px) minmax(280px,1fr) 330px!important}body.tpfUnified #view-whatsapplive.waCleanWorkspace.waClientHidden .waLiveLayout{grid-template-columns:clamp(250px,21vw,300px) minmax(280px,1fr)!important}#view-whatsapplive .waTabs button{font-size:13px!important;padding:9px 12px!important}#view-whatsapplive .waChatTopActions{justify-content:flex-end!important}#view-whatsapplive .waChatRowName{font-size:13px!important}}
`;document.head.append(style);
install();document.addEventListener('DOMContentLoaded',install,{once:true});setTimeout(install,600);
})();
