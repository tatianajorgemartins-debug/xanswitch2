// Nome do "bucket" (pasta de armazenamento) no Supabase Storage onde ficam
// as capas dos jogos e as capturas de tela. Fica num arquivo separado, sem
// nenhuma chave/segredo, porque tanto código de servidor (lib/supabaseAdmin.ts)
// quanto código que roda no navegador (lib/supabaseBrowser.ts) precisam saber
// esse nome — e código do navegador nunca pode importar nada que tenha uma
// chave secreta dentro.
export const IMAGES_BUCKET = 'game-images';
