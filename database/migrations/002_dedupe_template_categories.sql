-- Migration: deduplica categorias template (user_id IS NULL)
--
-- Antes da correcao do migrate runner, schema.sql era re-aplicado a cada
-- execucao. Como o INSERT IGNORE das categorias seed nao especificava
-- user_id e o MySQL trata NULL como distinto em UNIQUE keys compostas,
-- cada execucao criava uma copia adicional de cada template.
--
-- Esta migration mantem apenas a primeira ocorrencia (menor id) de cada
-- combinacao (name, type) com user_id NULL e remove o resto.

DELETE c1 FROM categories c1
INNER JOIN categories c2
  ON c1.user_id IS NULL
  AND c2.user_id IS NULL
  AND c1.name = c2.name
  AND c1.type = c2.type
  AND c1.id > c2.id;
