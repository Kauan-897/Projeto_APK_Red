import React from 'react';
import { Link } from 'react-router-dom';
import { LEGAL_VERSION, PRIVACIDADE, TERMOS } from '../legal/documents';

// Páginas públicas /termos e /privacidade
export default function LegalPage({ doc }) {
  const content = doc === 'privacidade' ? PRIVACIDADE : TERMOS;
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 px-4 py-12">
      <article className="max-w-3xl mx-auto">
        <Link to="/" className="text-sm text-red-400 hover:text-red-300">← Voltar</Link>
        <h1 className="text-3xl font-bold text-white mt-4 mb-1">{content.title}</h1>
        <p className="text-xs text-slate-500 mb-8">Versão {LEGAL_VERSION}</p>
        {content.sections.map(([title, text]) => (
          <section key={title} className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-1">{title}</h2>
            <p className="leading-relaxed">{text}</p>
          </section>
        ))}
        <p className="text-sm text-slate-500 mt-10">
          Veja também: {doc === 'privacidade'
            ? <Link to="/termos" className="text-red-400 hover:text-red-300">Termos de Uso</Link>
            : <Link to="/privacidade" className="text-red-400 hover:text-red-300">Política de Privacidade</Link>}
        </p>
      </article>
    </div>
  );
}
