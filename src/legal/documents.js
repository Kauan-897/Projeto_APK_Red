// =====================================================================
// DOCUMENTOS LEGAIS — RASCUNHO PARA REVISÃO JURÍDICA
// ---------------------------------------------------------------------
// Estes textos foram redigidos com base na LGPD (Lei 13.709/2018) e
// PRECISAM ser revisados por um advogado antes do uso comercial,
// em especial por envolverem dado sensível (convicção religiosa) e
// dados de crianças.
//
// Ao alterar qualquer texto: troque LEGAL_VERSION aqui E a versão na
// tabela public.legal_versions (nova migration). Todos os usuários
// terão de aceitar novamente.
// =====================================================================

export const LEGAL_VERSION = '2026-11-27';

// Preencha com os dados reais da empresa antes de vender.
export const PLATFORM = {
  name: 'Igreja Digital',
  legalName: '[RAZÃO SOCIAL DA EMPRESA]',
  cnpj: '[CNPJ]',
  dpoName: '[NOME DO ENCARREGADO]',
  dpoEmail: '[E-MAIL DO ENCARREGADO]',
  city: '[CIDADE/UF]',
};

const P = PLATFORM;

export const TERMOS = {
  title: 'Termos de Uso',
  sections: [
    ['1. O serviço', `O ${P.name} é uma plataforma on-line, oferecida por ${P.legalName} (CNPJ ${P.cnpj}), para que igrejas organizem membros, ministérios, escalas, eventos e comunicação.`],
    ['2. Quem é quem', 'Cada igreja cadastrada é a CONTROLADORA dos dados de seus membros: ela decide quais dados coleta e para quê. A plataforma atua como OPERADORA, tratando os dados em nome da igreja e conforme estes termos (LGPD, art. 5º, VI e VII, e art. 39).'],
    ['3. Conta', 'Você é responsável pela veracidade dos seus dados e pelo sigilo da sua senha. A entrada em uma igreja acontece somente por convite da liderança dela.'],
    ['4. Assinatura da igreja', 'Igrejas têm 14 dias de teste grátis. Depois disso, o uso depende de assinatura paga pela igreja. Sem assinatura ativa, os dados continuam disponíveis para consulta, mas não podem ser alterados.'],
    ['5. Uso adequado', 'É proibido usar a plataforma para fins ilícitos, para enviar conteúdo ofensivo ou para acessar dados de outras igrejas ou pessoas sem autorização.'],
    ['6. Encerramento', 'Você pode sair da igreja ou excluir sua conta a qualquer momento em "Meus dados". A exclusão remove seus dados pessoais, ressalvadas as hipóteses de guarda previstas no art. 16 da LGPD.'],
    ['7. Alterações', 'Se estes termos mudarem, avisaremos no aplicativo e pediremos um novo aceite.'],
    ['8. Foro', `Fica eleito o foro da comarca de ${P.city}, ressalvado o direito do consumidor de demandar no foro do seu domicílio.`],
  ],
};

export const PRIVACIDADE = {
  title: 'Política de Privacidade',
  sections: [
    ['1. Dados que tratamos', 'Cadastro (nome, e-mail, gênero, data de nascimento, endereço, estado civil, nome do cônjuge), dados dos filhos (somente com consentimento próprio), vínculo com a igreja, cargo, ministérios, escalas, presenças em eventos e anotações pessoais.'],
    ['2. Dado sensível', 'Fazer parte de uma igreja revela convicção religiosa, considerada dado pessoal sensível pela LGPD (art. 5º, II). Por isso, esse tratamento só ocorre com o seu consentimento específico e destacado (art. 11, I), que pode ser revogado a qualquer momento.'],
    ['3. Para que usamos', 'Para que a sua igreja organize membros, ministérios, escalas e eventos; para autenticação e segurança da conta; e para cobrança da assinatura da igreja. Não vendemos dados e não os usamos para publicidade.'],
    ['4. Quem vê seus dados', 'Membros da sua igreja veem apenas seu nome, foto e cargo. Contato e dados pessoais ficam visíveis somente para você e para a liderança da sua igreja. Nenhuma outra igreja tem acesso aos seus dados.'],
    ['5. Com quem compartilhamos', 'Supabase (banco de dados e autenticação), Vercel (hospedagem do site) e Asaas (cobrança da assinatura, que recebe apenas os dados de faturamento da igreja). Esses fornecedores atuam como suboperadores, sob obrigações de segurança e confidencialidade.'],
    ['6. Por quanto tempo', 'Enquanto você for membro e a conta existir. Ao sair da igreja, seus vínculos com ela são apagados; ao excluir a conta, seus dados pessoais são eliminados.'],
    ['7. Seus direitos (art. 18)', 'Confirmar o tratamento, acessar e baixar seus dados, corrigi-los, pedir a eliminação, revogar o consentimento e saber com quem compartilhamos. Quase tudo pode ser feito sozinho em "Meus dados"; o restante, pelo encarregado.'],
    ['8. Segurança', 'Isolamento de dados por igreja garantido no banco de dados, criptografia em trânsito, controle de acesso por cargo e registro das operações sensíveis (art. 37 e 46).'],
    ['9. Crianças e adolescentes', 'Dados de filhos só são registrados com o consentimento específico de um dos pais ou responsável (art. 14), que pode revogá-lo a qualquer momento, apagando esses dados.'],
    ['10. Encarregado', `Encarregado da plataforma: ${P.dpoName} — ${P.dpoEmail}. Cada igreja também pode indicar o seu encarregado, exibido em "Meus dados".`],
  ],
};

export const CONSENT_RELIGIOSO = {
  title: 'Consentimento para tratamento de dado sensível',
  text: 'Autorizo, de forma específica e destacada, o tratamento do meu vínculo com a igreja — dado que revela convicção religiosa (LGPD, art. 5º, II) — e dos dados ligados a ele (ministérios, escalas e presenças), exclusivamente para a organização das atividades da igreja da qual faço parte. Sei que posso revogar este consentimento a qualquer momento; nesse caso, deixo de fazer parte da igreja no aplicativo e esses vínculos são apagados.',
};

export const CONSENT_FILHOS = {
  title: 'Consentimento para dados dos filhos',
  text: 'Como mãe, pai ou responsável legal, autorizo o registro dos dados dos meus filhos que eu informar (por exemplo, nome e idade), somente para a organização das atividades infantis da igreja (LGPD, art. 14, § 1º). Posso revogar a qualquer momento, e esses dados serão apagados.',
};
