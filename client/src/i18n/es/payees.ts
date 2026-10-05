import type { Translation } from '../catalog';
import type en from '../en/payees';

const es: Translation<typeof en> = {
  title: 'Beneficiarios',
  loading: 'Cargando...',
  search: 'Buscar beneficiarios…',
  noMatch: 'Ningún beneficiario coincide con tu búsqueda.',
  emptyTitle: 'Todavía no hay beneficiarios',
  emptyDescription:
    'Los beneficiarios son las personas y los comercios a los que les pagás o que te pagan. Se agregan solos a medida que ingresás o importás transacciones, y a cada uno le podés dar una categoría predeterminada.',
  addTransaction: 'Agregar una transacción',
  list: 'Beneficiarios',
  selectAllPayees: 'Seleccionar todos los beneficiarios',
  selectAll: 'Seleccionar todos',
  select: 'Seleccionar {{name}}',
  rename: 'Cambiar nombre',
  renameNamed: 'Cambiar nombre de {{name}}',
  doubleClickRename: 'Doble clic para cambiar el nombre',
  actionsFor: 'Acciones de {{name}}',
  delete: 'Eliminar',
  deleteNamed: 'Eliminar {{name}}',
  name: 'Nombre',
  defaultCategory: 'Categoría predeterminada',
  defaultCategoryFor: 'Categoría predeterminada de {{name}}',
  noDefaultCategory: 'Sin categoría predeterminada',
  noDefault: 'Sin predeterminada',
  transactions: 'Transacciones',
  transactionCount_one: '{{count}} transacción',
  transactionCount_other: '{{count}} transacciones',
  mergeSelected: 'Combinar {{total}} beneficiarios',
  mergeTitle: 'Combinar beneficiarios',
  mergeIntro:
    'Elegí qué nombre de beneficiario conservar. Todas las transacciones pasan al beneficiario elegido.',
  merge: 'Combinar',
  deleteTitle: 'Eliminar beneficiario',
  deleteMessage: '¿Eliminar "{{name}}"? El beneficiario se va a quitar de todas sus transacciones.',
  changeImage: 'Cambiar la imagen de {{name}}',
  uploadImage: 'Subir una imagen para {{name}}',
  removeImage: 'Quitar la imagen de {{name}}',
  useInitial: 'Usar la inicial',
  imageError: 'No se pudo usar esa imagen.',
};

export default es;
