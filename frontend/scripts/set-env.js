const fs = require('fs');
const path = require('path');

// Cargar variables de entorno desde .env si existe en frontend o raíz
function loadEnv() {
  const envPaths = [
    path.join(__dirname, '../.env'),
    path.join(__dirname, '../../.env')
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
          if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
          if (!process.env[key]) {
            process.env[key] = value.trim();
          }
        }
      });
    }
  }
}

loadEnv();

const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'localhost/api/v1';

const targetPath = path.join(__dirname, '../src/environments/environment.prod.ts');
const envConfigFile = `// Generado automáticamente por scripts/set-env.js antes del build
export const environment = {
  production: true,
  apiUrl: '${apiUrl}'
};
`;

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, envConfigFile);
console.log(`✅ [Frontend Config] environment.prod.ts generado exitosamente con apiUrl: ${apiUrl}`);
