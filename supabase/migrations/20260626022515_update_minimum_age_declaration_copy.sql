do $$
declare
  declaration_content text := 'Declaro que tengo al menos 18 años y entiendo que esta declaración es necesaria para crear y operar una cuenta de tienda en VortexHub.';
begin
  update public.legal_document_versions
  set is_current = false,
      updated_at = now()
  where document_key = 'minimum_age_declaration'
    and is_current;

  insert into public.legal_document_versions (
    document_key,
    version,
    content,
    content_hash,
    is_current,
    published_at
  ) values (
    'minimum_age_declaration',
    '2026-06-26',
    declaration_content,
    encode(extensions.digest(declaration_content, 'sha256'), 'hex'),
    true,
    now()
  );
end $$;
