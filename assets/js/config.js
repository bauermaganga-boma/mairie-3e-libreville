/* Connexion à la base de données Supabase (site de la mairie du 3e arrondissement de Libreville).
   Laisser vide = mode démonstration (données enregistrées dans le navigateur, clé l3e_db_v1).
   Renseigner l'URL du projet et la clé publique « anon » = mode réel partagé par tous les services.
   (La clé « anon » est publique par conception : la sécurité est assurée par les règles RLS de la base.) */
window.ESM_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  // Afficher les comptes de démonstration sur la page de connexion (mettre false en production)
  showDemo: true,
};
