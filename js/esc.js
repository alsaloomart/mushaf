/* v26z11: دالة تهريب واحدة لكل ما يدخل HTML من بيانات المستخدم أو المزامنة (app.js وcloud.js وadhkar.js) — تهرّب & < > " ' */
window.ESC = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
