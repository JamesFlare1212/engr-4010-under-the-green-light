import { mount } from 'svelte';
import App from './App.svelte';
import '@fontsource-variable/noto-sans-sc';
import './app.css';
mount(App, { target: document.getElementById('app')! });
