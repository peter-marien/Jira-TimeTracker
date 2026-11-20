import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withHashLocation } from '@angular/router';
import { App, routes } from './app/app';
import { installRendererErrorLogging } from './lib/logging';

installRendererErrorLogging();
void bootstrapApplication(App, {
    providers: [provideRouter(routes, withHashLocation())]
}).catch(error => console.error('Could not start the application', error));
