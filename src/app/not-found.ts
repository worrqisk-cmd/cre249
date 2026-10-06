import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({ standalone: true, imports: [RouterLink], template: '<section class="section container"><h1>Страница не найдена</h1><a routerLink="/catalog/">Перейти в каталог</a></section>' })
export class NotFound {}
