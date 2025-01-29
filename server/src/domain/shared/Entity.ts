export abstract class Entity {
  protected readonly _id: string;

  constructor(id: string) {
    this._id = id;
  }

  get id(): string {
    return this._id;
  }

  equals(entity: Entity): boolean {
    if (entity === null || entity === undefined) {
      return false;
    }
    if (!(entity instanceof Entity)) {
      return false;
    }
    return this._id === entity._id;
  }
}
