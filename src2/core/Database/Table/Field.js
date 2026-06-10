export class Field {
  constructor(metadata) {
    this.id = metadata.f_id;
    this.tableid = metadata.f_t_id;
    this.name = metadata.f_name;
    this.titel = metadata.f_titel
    this.type = metadata.f_typ;
    this.reference = metadata.f_referenz;
    this.weight = metadata.f_weight;
    this.isLabel = metadata.f_isLabel === true;
  }
}