(function(){'use strict';
window.TPFWhatsAppTemplateStore={
 async upsert(t){if(typeof sb==='undefined'||!sb?.rpc)throw new Error('Supabase no está disponible.');const {data,error}=await sb.rpc('wa_upsert_template',{p_id:t.id||null,p_name:t.name,p_body:t.text,p_category:t.category||null,p_shortcut:t.shortcut||null});if(error)throw error;return data},
 async remove(id){if(typeof sb==='undefined'||!sb?.rpc)throw new Error('Supabase no está disponible.');const {error}=await sb.rpc('wa_delete_template',{p_id:id});if(error)throw error;return true},
 async refresh(){if(typeof waSyncTemplatesFromSupabase==='function')await waSyncTemplatesFromSupabase();return typeof waLoadTemplates==='function'?waLoadTemplates():[]},
 localSave(list){if(typeof waSaveTemplates==='function')waSaveTemplates(list);if(typeof waRenderTemplates==='function')waRenderTemplates()}
};
})();