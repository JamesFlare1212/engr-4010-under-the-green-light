export {};
const children = [
  Bun.spawn(['bun', '--watch', 'server/index.ts'], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' }),
  Bun.spawn(['bun', '--bun', 'node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' })
];
const stop = () => { children.forEach(child => child.kill()); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
const exitCode = await Promise.race(children.map(child => child.exited));
children.forEach(child => child.kill());
process.exit(exitCode);
