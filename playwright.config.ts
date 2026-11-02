import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests',testMatch:'*.spec.ts',timeout:30000,workers:2,use:{baseURL:'http://127.0.0.1:4173',headless:true,reducedMotion:'reduce',screenshot:'only-on-failure'},webServer:{command:'npx vite preview --host 127.0.0.1 --port 4173',url:'http://127.0.0.1:4173/themes/MD3/dist/',reuseExistingServer:!process.env.CI}});
