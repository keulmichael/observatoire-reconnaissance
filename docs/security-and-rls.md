# Securite et RLS

RLS est active sur les tables contenant des donnees utilisateur. Les politiques autorisent lecture, insertion, mise a jour et suppression uniquement lorsque `owner_id = auth.uid()`.

La cle `SUPABASE_SERVICE_ROLE_KEY` ne doit jamais etre exposee au navigateur. Le client utilise seulement `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Les operations sensibles futures devront passer par des routes serveur.

Le bucket Storage `observatory-attachments` est prive et limite au proprietaire de l'objet.
