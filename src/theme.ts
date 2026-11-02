import {argbFromHex,hexFromArgb,SchemeTonalSpot,Hct} from '@material/material-color-utilities';
export function stored(key:string){try{return localStorage.getItem(key);}catch{return null;}}
export function save(key:string,value:string){try{localStorage.setItem(key,value);}catch{/* Private browsing may disallow storage. */}}
export function applyTheme(seed:string,appearance:string){
  const dark=appearance==='dark'||(appearance==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
  const valid=/^#[0-9a-f]{6}$/i.test(seed)?seed:'#6750A4';
  const scheme=new SchemeTonalSpot(Hct.fromInt(argbFromHex(valid)),dark,0);
  const roles=['primary','onPrimary','primaryContainer','onPrimaryContainer','secondary','onSecondary','secondaryContainer','onSecondaryContainer','tertiary','onTertiary','tertiaryContainer','onTertiaryContainer','error','onError','errorContainer','onErrorContainer','background','onBackground','surface','onSurface','surfaceVariant','onSurfaceVariant','outline','outlineVariant','inverseSurface','inverseOnSurface','inversePrimary','surfaceDim','surfaceBright','surfaceContainerLowest','surfaceContainerLow','surfaceContainer','surfaceContainerHigh','surfaceContainerHighest'] as const;
  for(const role of roles)document.documentElement.style.setProperty(`--md-sys-color-${role.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}`,hexFromArgb(scheme[role]));
  document.documentElement.style.colorScheme=dark?'dark':'light';document.documentElement.dataset.mode=dark?'dark':'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',hexFromArgb(scheme.surface));
}
