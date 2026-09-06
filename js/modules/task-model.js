(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TPFTaskModel=api;})(typeof window==='undefined'?globalThis:window,function(){
'use strict';
const text=v=>String(v??'').trim();
function date(value,optional=false){if(!value&&optional)return null;const d=new Date(value);if(!value||!Number.isFinite(d.getTime()))throw Error('La fecha no es válida.');return d.toISOString();}
function payload(input,previous={}){
 const value={...previous,...input},title=text(value.title);if(!title||!value.starts_at)throw Error('Escribe un asunto y una fecha/hora.');
 const out={title,description:text(value.description)||null,starts_at:date(value.starts_at),reminder_at:date(value.reminder_at,true),agenda_type:text(value.agenda_type)||'Tarea',agenda_meta:{...(value.agenda_meta||{})},notify_in_app:value.notify_in_app!==false,notify_email:!!value.notify_email,sync_google_calendar:!!value.sync_google_calendar};
 for(const k of ['customer_name','customer_phone','related_record_id','assigned_to'])if(k in value)out[k]=text(value[k])||null;
 if('status' in value){if(!['pending','completed','cancelled'].includes(value.status))throw Error('El estado no es válido.');out.status=value.status;}
 if('reminder_minutes' in value)out.reminder_minutes=[...new Set((value.reminder_minutes||[]).filter(v=>Number.isFinite(v)&&v>=0))];
 // Editing a normal task must not enable a message delivery as a side effect.
 if('whatsapp_enabled' in previous)out.whatsapp_enabled=!!previous.whatsapp_enabled;
 return out;
}
async function save(client,input,{id,previous={},canManage=false,userId,allowScheduled=false}={}){
 if(!canManage)throw Error('No tienes permiso para gestionar tareas.');
 const row=payload(input,previous);let query;
 if(allowScheduled&&input.whatsapp_enabled){Object.assign(row,{whatsapp_enabled:true,whatsapp_phone:text(input.whatsapp_phone)||null,whatsapp_message:text(input.whatsapp_message)||null,whatsapp_scheduled_at:date(input.whatsapp_scheduled_at||row.starts_at)});}
 if(id){query=client.from('agenda_items').update(row).eq('id',id);if(previous.updated_at)query=query.eq('updated_at',previous.updated_at);}
 else query=client.from('agenda_items').insert({...row,assigned_to:userId||row.assigned_to||null,status:row.status||'pending',whatsapp_enabled:allowScheduled&&!!row.whatsapp_enabled});
 const result=await query.select('*').single();if(result.error){if(result.error.code==='PGRST116')throw Error('La tarea ha cambiado o ya no está disponible. Ábrela de nuevo antes de guardar.');throw result.error;}
 if(!result.data)throw Error('No se ha confirmado el guardado de la tarea.');return result.data;
}
return {payload,save};
});
