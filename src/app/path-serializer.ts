import { DefaultUrlSerializer, UrlTree } from '@angular/router';
export class PathSerializer extends DefaultUrlSerializer {
  override serialize(tree: UrlTree): string {
    return super
      .serialize(tree)
      .replace(
        /^([^?#]*?)(\/?)([?#].*)?$/,
        (_, path, slash, suffix = '') => (path || '') + '/' + suffix,
      );
  }
}
