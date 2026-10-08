import { DefaultUrlSerializer, UrlTree } from '@angular/router';
export class PathSerializer extends DefaultUrlSerializer {
  override serialize(tree: UrlTree): string {
    return super
      .serialize(tree)
      .replace(
        /^([^?#]*?)(\/?)([?#].*)?$/,
        (_match: string, path: string, _slash: string, suffix = '') => (path || '') + '/' + suffix,
      );
  }
}
