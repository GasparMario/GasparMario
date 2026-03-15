# dtf-manager

Sistema web em **Next.js + TypeScript + Supabase** para upload, busca e download de PDFs de estampas DTF.

## O que mudou para suportar PDFs grandes

O upload agora é **direto do navegador para o Supabase Storage**. Assim, o arquivo PDF **não passa pela API Route do Next/Vercel**, evitando erro de limite de payload e falhas como `Unexpected token 'R'` em respostas não-JSON.

Fluxo atual:
1. Frontend envia o PDF direto ao bucket `dtf-pdfs`.
2. Após upload concluído, frontend chama `POST /api/dtf/artes` apenas com metadados.
3. A listagem busca no banco e gera **URL assinada** de download (válida por 1 hora).

## Funcionalidades do MVP

- Upload de PDF com nome da arte e tags.
- Persistência de metadados na tabela `artes_dtf`.
- Busca por nome parcial com normalização (`nome_normalizado`) ignorando maiúsculas/minúsculas e acentuação.
- Listagem ordenada pelos mais recentes primeiro.
- Download do PDF por item.
- Tratamento básico de erros na API e na interface.

## Pré-requisitos

- Node.js 20+
- Projeto Supabase criado

## 1) Instalação

```bash
npm install