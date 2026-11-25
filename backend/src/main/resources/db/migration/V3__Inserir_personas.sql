-- ========================================================
-- V3: Inserção das Personas Oficiais do Sistema GerObras
-- Ricardo Almeida (admin), Camila Ferreira (engenheiro) e João Carlos Mendes (mestre_de_obras)
-- Senha padrão para todas as personas: admin123 (hash SHA-256)
-- ========================================================

-- Atualiza o administrador padrão inicial para a Persona 1 (Ricardo Almeida)
UPDATE usuarios 
SET nome = 'Ricardo Almeida', cargo = 'admin'
WHERE email = 'admin@obras.com';

-- Insere Persona 2 (Camila Ferreira) e Persona 3 (João Carlos Mendes)
INSERT INTO usuarios (nome, email, senha, cargo)
VALUES 
    (
        'Camila Ferreira',
        'camila@obras.com',
        '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
        'engenheiro'
    ),
    (
        'João Carlos Mendes',
        'joao@obras.com',
        '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
        'mestre_de_obras'
    )
ON CONFLICT (email) DO NOTHING;
