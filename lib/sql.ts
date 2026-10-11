// Conexão com o Postgres (Neon), compartilhada por TODOS os módulos de
// acesso a dados do projeto — lib/db.ts (catálogo digital) e
// lib/physicalProducts.ts (catálogo físico) usam o mesmo banco, só que em
// tabelas diferentes. Ficar num arquivo à parte evita duas conexões
// separadas e deixa claro que os dois catálogos compartilham só a
// infraestrutura de baixo nível (a conexão em si), nunca os dados.
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

// Criado só na primeira consulta, não quando este arquivo é importado —
// assim nada quebra em ambientes que importam este módulo sem nunca chamar
// nenhuma função dele mas também não têm DATABASE_URL configurada.
let sqlInstance: NeonQueryFunction<false, false> | null = null;
export function getSql(): NeonQueryFunction<false, false> {
  if (!sqlInstance) {
    sqlInstance = neon(process.env.DATABASE_URL!);
  }
  return sqlInstance;
}
