import { useState, useEffect, useRef, useContext, createContext } from "react";
import CITIES from "./psgc_cities.json"; /* PSGC 2025-2Q, cities only (small): [province, island M|V|L, [city…]]. Barangays load on demand (below). Production: an address API, barangays per city */
/* Barangays (the big part of PSGC) are NOT in the page. They load from psgc_brgy.json when the checkout opens: { "City|Province": [barangays] } */
let BRGY = null, BRGY_P = null;
const loadBrgy = () => BRGY_P || (BRGY_P = fetch("psgc_brgy.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((d) => (BRGY = d)).catch(() => { BRGY = false; }));
import { ArrowRight, Play, Menu, X, Check, ShoppingBag, Lock, ChevronDown, ArrowLeft } from "lucide-react";

/* ────────────────────────────────────────────────────────────
   Gutguard — Multi-page site (Home · Science · System · Shop · Physicians · About)
   Sept 2026 build: Addenda 01–03. Buying moved to the Lifestyle landing (guests) and the Lifestyle page (members).
   Self-contained hash router + shared shell. Accessibility complete:
   skip link · landmarks · logical headings · focus-trapped dialog
   (Esc to close, focus restored) · route-change focus · dark focus rings.
   Port note: routes → real router pages; CSS string → global layer.
   ──────────────────────────────────────────────────────────── */

const CSS = `
:root{
  --bone:#F4F1EA;--bone-soft:#EBE7DE;--bone-deep:#DDD7C8;--paper:#FCFAF5;
  --ink:#141019;--ink-2:#3A3A48;--ink-3:#6B6B7A;--ink-4:#A0A0AE;
  --rule:#D8D2C2;--rule-soft:#E5E0D2;
  --blue:#0608A9;--blue-press:#04067A;--blue-deep:#03044F;
  --gold:#B08D5B;--gold-soft:#C9AC7E;--gold-pale:#E8DCC4;--gold-text:#7E6035;
  --heat:#FF5E3A;--heat-brick:#BF4A2B;--heat-text:#B5431F;--heat-soft:rgba(255,94,58,.12);
  --recovery:#2F86C9;--recovery-deep:#1E6FB8;--recovery-soft:rgba(47,134,201,.12);
  --slate:#0E1A2B;--slate-2:#15263B;--slate-line:#22354E;--slate-mut:#8598AE;
  --serif:'Fraunces',Georgia,serif;--sans:'Inter Tight',system-ui,sans-serif;--mono:'IBM Plex Mono',ui-monospace,monospace;
  --maxw:1240px;--seam:linear-gradient(90deg,var(--heat),var(--gold),var(--recovery));
  --ease:cubic-bezier(.22,1,.36,1);--ease-io:cubic-bezier(.65,0,.35,1);
}
.gg *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
.gg{font-family:var(--sans);background:var(--bone);color:var(--ink);line-height:1.55;font-size:17px;
  font-feature-settings:'ss01','cv11';-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;overflow-x:hidden;position:relative;}
.gg::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:radial-gradient(circle at 1px 1px,rgba(20,16,25,.022) 1px,transparent 0);background-size:3px 3px;mix-blend-mode:multiply;}
:where(.gg a){color:inherit;text-decoration:none;}
:where(.gg button){font-family:inherit;cursor:pointer;border:0;background:0;color:inherit;}
.gg img{max-width:100%;display:block;}
.gg :focus-visible{outline:2px solid var(--blue);outline-offset:3px;border-radius:3px;}
.gg .measure :focus-visible,.gg .final :focus-visible,.gg .lca-hero.dark :focus-visible{outline-color:#F4F1EA;}
.gg main:focus{outline:none;}
.wrap{position:relative;z-index:1;max-width:var(--maxw);margin:0 auto;padding:0 clamp(20px,5vw,40px);}
/* true-desktop: canvas grows intentionally on large displays; text stays capped by ch */
@media(min-width:1600px){:root{--maxw:1320px;}}
@media(min-width:2000px){:root{--maxw:1400px;} .gg{font-size:18px;}}
/* premium text wrapping at every width */
.gg h1,.gg h2,.gg h3,.gg h4,.hero h1,.co-h1{text-wrap:balance;}
.gg p,.sec-body,.hero-lede,.mh-desc{text-wrap:pretty;}
/* touch devices: WCAG 2.5.5 / Apple-HIG tap targets (desktop stays compact) */
@media(pointer:coarse){
  .qty button{width:44px;height:44px;}
  .qty .q{min-width:38px;}
  .nav-cart{width:44px;height:44px;}
  .cart-x{width:44px;height:44px;}
  .cl-rm{padding:6px 2px;}
  .smap-sec{padding:5px 0;}
  .nav-login{padding:10px 0;}
  .foot-nav a{padding:6px 0;}
}
.seam{height:2px;border:0;background:var(--seam);background-size:220% 100%;opacity:.85;animation:seamFlow 14s var(--ease-io) infinite;}
@keyframes seamFlow{0%,100%{background-position:0% 50%;}50%{background-position:100% 50%;}}

/* skip link */
.skip{position:fixed;top:-100px;left:16px;z-index:200;background:var(--ink);color:var(--bone);padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600;transition:top .2s;}
.skip:focus{top:calc(12px + env(safe-area-inset-top));}

/* buttons — explicit contrast guards */
.gg .btn-primary,.gg .nav-cta{color:var(--bone);}
.gg .btn-primary{background:var(--blue);}
.gg .btn-primary:hover{background:var(--blue-press);}
.gg .nav-cta{background:var(--ink);}
.gg .nav-cta:hover{background:var(--blue);}
.gg .btn-bone{color:var(--blue);}
.gg .btn-ghost{color:var(--ink);}
.btn-primary{display:inline-flex;align-items:center;gap:12px;padding:17px 28px;background:var(--blue);border-radius:100px;font-size:15px;font-weight:600;transition:background .2s,transform .12s,box-shadow .3s;box-shadow:0 8px 28px rgba(6,8,169,.18);}
.btn-primary:hover{background:var(--blue-press);transform:translateY(-2px);box-shadow:0 14px 36px rgba(6,8,169,.26);}
.btn-primary:active{transform:translateY(0);}
.btn-primary .arr,.btn-bone .arr{width:27px;height:27px;display:flex;align-items:center;justify-content:center;border:1px solid currentColor;border-radius:50%;flex-shrink:0;}
.btn-ghost{display:inline-flex;align-items:center;gap:10px;font-size:15px;font-weight:600;min-height:44px;}
.btn-ghost .ring{width:34px;height:34px;border:1px solid var(--rule);border-radius:50%;display:flex;align-items:center;justify-content:center;transition:border-color .2s,background .2s;flex-shrink:0;}
.btn-ghost:hover .ring{border-color:var(--blue);background:var(--paper);}
.btn-ghost .ring svg{color:var(--blue);}
.btn-bone{display:inline-flex;align-items:center;gap:12px;padding:18px 34px;background:var(--bone);border-radius:100px;font-size:16px;font-weight:700;transition:transform .12s,box-shadow .3s;box-shadow:0 12px 40px rgba(0,0,0,.25);}
.btn-bone:hover{transform:translateY(-2px);box-shadow:0 18px 50px rgba(0,0,0,.32);}

/* nav */
.nav{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(244,241,234,.82);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid transparent;transition:border-color .3s;}
.nav.scrolled{border-bottom-color:var(--rule);}
.nav::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--seam);}
.nav-inner{max-width:var(--maxw);margin:0 auto;padding:14px clamp(20px,5vw,32px);padding-top:max(14px,env(safe-area-inset-top));display:flex;align-items:center;justify-content:space-between;gap:16px;}
.brand{display:flex;align-items:center;gap:2px;}
.nav-back{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;border:1px solid var(--rule);background:transparent;color:var(--ink);cursor:pointer;flex:none;transition:background .2s var(--ease);}
.nav-back:hover{background:var(--bone);}
@media(pointer:coarse){.nav-back{width:44px;height:44px;}}
.brand .g{font-family:var(--serif);font-weight:500;font-size:22px;letter-spacing:-.01em;}
.brand .reg{font-family:var(--mono);font-size:9px;color:var(--ink-4);align-self:flex-start;margin-top:3px;}
.nav-links{display:flex;align-items:center;gap:26px;}
.nav-links a{font-size:14px;font-weight:500;color:var(--ink-2);transition:color .2s;padding:6px 0;position:relative;}
.nav-links a:hover{color:var(--blue);}
.nav-links a[aria-current="page"]{color:var(--blue);}
.nav-links a[aria-current="page"]::after{content:'';position:absolute;left:0;right:0;bottom:-2px;height:2px;background:var(--seam);border-radius:2px;}
.nav-cta{display:inline-flex;align-items:center;gap:8px;padding:11px 20px;background:var(--ink);border-radius:100px;font-size:14px;font-weight:600;transition:background .2s,transform .1s;}
.nav-cta:hover{background:var(--blue);}.nav-cta:active{transform:scale(.97);}
.burger{display:none;width:44px;height:44px;border:1px solid var(--rule);border-radius:10px;align-items:center;justify-content:center;background:var(--paper);}
.sheet{position:fixed;inset:0;z-index:99;background:var(--bone);padding:max(92px,calc(72px + env(safe-area-inset-top))) clamp(20px,6vw,32px) max(40px,env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:4px;transform:translateY(-100%);transition:transform .4s cubic-bezier(.22,1,.36,1);visibility:hidden;overflow-y:auto;}
.sheet.open{transform:none;visibility:visible;}
.sheet a{font-family:var(--serif);font-size:clamp(26px,7vw,32px);padding:13px 0;border-bottom:1px solid var(--rule);}
.sheet a em{font-style:italic;color:var(--blue);margin-right:10px;}
.sheet a[aria-current="page"]{color:var(--blue);}
.sheet .nav-cta{margin-top:22px;justify-content:center;font-size:16px;padding:16px;}
.sheet .sheet-close{position:absolute;top:max(16px,env(safe-area-inset-top));right:18px;}
@media(max-width:860px){.nav-links{display:none;}.nav-inner>.nav-cta{display:none;}.burger{display:flex;}}

/* section tabs (per-page jump nav) */
.sectabs{position:fixed;left:0;right:0;z-index:90;background:rgba(252,250,245,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid var(--rule);transform:translateY(-100%);opacity:0;transition:transform .35s cubic-bezier(.22,1,.36,1),opacity .25s;pointer-events:none;}
.sectabs.show{transform:none;opacity:1;pointer-events:auto;}
.sectabs::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:1px;background:var(--seam);opacity:.5;}
.sectabs-inner{max-width:var(--maxw);margin:0 auto;display:flex;gap:6px;padding:9px clamp(14px,5vw,32px);overflow-x:auto;scrollbar-width:none;}
.sectabs-inner::-webkit-scrollbar{display:none;}
.sectab{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);padding:8px 15px;border-radius:100px;white-space:nowrap;transition:color .2s,background .2s,border-color .2s;flex-shrink:0;min-height:36px;border:1px solid transparent;}
.sectab:hover{color:var(--blue);}
.sectab.on{color:var(--blue);background:var(--bone);border-color:var(--rule);}
@media(prefers-reduced-motion:reduce){.sectabs{transition:none;}}

/* section frame */
.section{padding:clamp(56px,9vw,90px) 0;position:relative;z-index:1;}
.sec-label{display:flex;align-items:center;gap:12px;font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-3);margin-bottom:20px;}
.sec-label::before{content:'';width:24px;height:1px;background:var(--ink-3);}
.sec-label .num{color:var(--blue);}
h2.sec{font-family:var(--serif);font-weight:400;font-size:clamp(30px,5vw,52px);line-height:1.03;letter-spacing:-.02em;max-width:18ch;margin-bottom:16px;}
h2.sec em{font-style:italic;color:var(--blue);}
.sec-sub{font-family:var(--serif);font-style:italic;font-size:clamp(17px,2vw,20px);line-height:1.45;color:var(--gold-text);max-width:46ch;margin-bottom:8px;}
.sec-body{font-size:16.5px;line-height:1.62;color:var(--ink-2);max-width:58ch;}

/* hero */
.hero{padding:140px 0 56px;position:relative;overflow:hidden;background:var(--bone);}
.hero::after{content:'';position:absolute;top:-8%;right:-12%;width:680px;height:680px;background:radial-gradient(circle,rgba(176,141,91,.12),transparent 64%);pointer-events:none;}
.hero-grid{position:relative;z-index:1;display:grid;grid-template-columns:1.04fr .96fr;gap:54px;align-items:center;}
@media(max-width:920px){.hero-grid{grid-template-columns:1fr;gap:36px;}}
.eyebrow{display:inline-flex;align-items:center;gap:10px;font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--blue);margin-bottom:24px;}
.eyebrow::before{content:'';width:26px;height:1px;background:var(--blue);}
.hero h1{font-family:var(--serif);font-weight:400;font-size:clamp(34px,7vw,76px);line-height:.99;letter-spacing:-.025em;max-width:15ch;margin-bottom:22px;overflow-wrap:break-word;}
.hero h1 em{font-style:italic;color:var(--blue);}
.hero-lede{font-family:var(--serif);font-size:clamp(17px,2.2vw,21px);line-height:1.5;color:var(--ink-2);max-width:46ch;margin-bottom:30px;}
.hero-lede strong{font-weight:500;color:var(--ink);}
.hero-actions{display:flex;flex-wrap:wrap;align-items:center;gap:16px 22px;}
.hero-proof{display:flex;flex-wrap:wrap;align-items:center;gap:9px 20px;margin-top:32px;padding-top:22px;border-top:1px solid var(--rule);list-style:none;max-width:46ch;}
.hero-proof li{font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3);position:relative;padding-left:16px;}
.hero-proof li::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:6px;height:6px;border-radius:50%;background:var(--recovery-deep);}
/* why-now: stat row + young review */
.stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:40px;}
@media(max-width:720px){.stat-row{grid-template-columns:1fr;gap:14px;}}
.stat{padding:24px 22px;background:var(--paper);border:1px solid var(--rule);border-radius:16px;border-left:3px solid var(--heat-brick);}
.stat-n{display:block;font-family:var(--serif);font-size:clamp(30px,4vw,40px);line-height:1;color:var(--ink);margin-bottom:10px;letter-spacing:-.02em;}
.stat-n small{font-family:var(--mono);font-size:14px;font-weight:600;color:var(--ink-3);margin-left:3px;}
.stat-l{font-size:14px;line-height:1.45;color:var(--ink-2);}
.stat-note{font-family:var(--mono);font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-4);margin-top:14px;}
.review{margin-top:44px;max-width:62ch;padding:clamp(26px,4vw,34px);background:var(--slate);color:var(--bone);border-radius:18px;position:relative;overflow:hidden;}
.review::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--seam);}
.review-q{font-family:var(--serif);font-size:clamp(19px,2.4vw,24px);line-height:1.45;letter-spacing:-.01em;margin-bottom:22px;}
.review-who{display:flex;align-items:center;gap:14px;}
.review-av{width:44px;height:44px;border-radius:50%;background:linear-gradient(150deg,var(--gold),var(--gold-soft));display:flex;align-items:center;justify-content:center;color:var(--slate);font-family:var(--serif);flex-shrink:0;}
.review-nm{font-weight:600;font-size:15px;}
.review-role{font-family:var(--mono);font-size:11px;color:var(--slate-mut);margin-top:2px;letter-spacing:.03em;}
/* citations + references */
sup a{color:var(--blue);text-decoration:none;font-weight:600;}
.measure sup a{color:var(--gold-soft);}
.refs{padding-top:clamp(40px,6vw,64px);}
.ref-list{list-style:decimal;padding-left:22px;margin-top:18px;max-width:84ch;display:flex;flex-direction:column;gap:11px;}
.ref-list li{font-size:13px;line-height:1.55;color:var(--ink-3);padding-left:4px;}
.ref-list li i{font-style:italic;}
.ref-note{font-size:12.5px;line-height:1.5;color:var(--ink-4);margin-top:18px;max-width:72ch;}
.ev-intro{font-size:14px;line-height:1.62;color:var(--ink-2);margin-top:15px;max-width:80ch;}
.ev-intro b{color:var(--ink);font-weight:600;}
.own-ev{list-style:none;padding:0;margin-top:18px;max-width:82ch;display:flex;flex-direction:column;gap:13px;}
.own-ev li{border:1px solid var(--rule);border-radius:13px;padding:16px 18px;background:var(--paper);}
.own-ev h4{font-size:15px;font-weight:600;color:var(--ink);margin:0 0 5px;letter-spacing:-.01em;}
.own-ev p{font-size:13px;line-height:1.56;color:var(--ink-3);margin:0;}
.ev-status{display:inline-block;font-family:var(--mono);font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--heat-text);background:color-mix(in srgb, var(--heat) 13%, transparent);border-radius:999px;padding:3px 9px;margin-bottom:9px;}
.ev-ph{color:var(--ink-4);font-style:italic;}
.composition{margin-top:44px;}
.comp-h{font-family:var(--serif);font-size:clamp(22px,3vw,28px);color:var(--ink);margin:0 0 14px;}
.comp{border:1px solid var(--rule);border-radius:14px;background:var(--paper);overflow:hidden;}
.comp summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;font-weight:600;font-size:15px;color:var(--ink);}
.comp summary::-webkit-details-marker{display:none;}
.comp summary svg{transition:transform .25s ease;color:var(--blue);flex:none;}
.comp[open] summary svg{transform:rotate(180deg);}
.comp[open] summary{border-bottom:1px solid var(--rule);}
.comp-body{padding:20px;}
.comp-group{margin-top:22px;}
.comp-group:first-child{margin-top:0;}
.comp-group h4{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold-text);margin:0 0 12px;}
.comp-list{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:1fr 1fr;gap:9px 28px;}
.comp-list li{font-size:13.5px;line-height:1.5;color:var(--ink-3);padding-left:15px;position:relative;}
.comp-list li::before{content:"";position:absolute;left:0;top:8px;width:5px;height:5px;border-radius:50%;background:var(--gold-soft);}
.comp-list li b{color:var(--ink);font-weight:600;font-style:italic;}
.comp-p{font-size:13.5px;line-height:1.55;color:var(--ink-3);margin:0;}
.comp-ph{color:var(--ink-4);font-style:italic;}
.comp-note{margin-top:22px;font-size:12px;line-height:1.5;color:var(--ink-4);font-style:italic;}
@media(max-width:680px){.comp-list{grid-template-columns:1fr;}}
.comp-layers{margin-top:30px;display:flex;flex-direction:column;border-top:1px solid var(--slate-line);}
.comp-layers .layer{display:flex;gap:22px;padding:20px 0;border-bottom:1px solid var(--slate-line);align-items:flex-start;}
.lyr-tag{flex:none;width:104px;font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold-soft);padding-top:5px;}
.comp-layers .layer h3{font-family:var(--serif);font-size:19px;color:#F4F1EA;margin:0 0 5px;font-weight:400;}
.comp-layers .layer h3 i{font-style:italic;}
.comp-layers .layer p{font-size:14px;line-height:1.6;color:#B8C6D6;margin:0;max-width:72ch;}
.comp-layers .layer sup a{color:var(--gold-soft);}
.ref-list.dark li{color:#8598AE;}
@media(max-width:680px){.comp-layers .layer{flex-direction:column;gap:6px;}.lyr-tag{width:auto;padding-top:0;}}

/* portrait + readout */
.hero-visual{position:relative;}
.portrait{position:relative;border-radius:18px;overflow:hidden;aspect-ratio:4/5;box-shadow:0 40px 90px -40px rgba(20,16,25,.45);border:1px solid var(--rule);}
.portrait .grade{position:absolute;inset:0;background:radial-gradient(120% 80% at 28% 18%,#F7E6CC,transparent 55%),radial-gradient(130% 110% at 82% 92%,#B6764E,transparent 55%),linear-gradient(158deg,#E9CBA6,#C68A5E 48%,#9E6A48);}
.portrait .grain{position:absolute;inset:0;mix-blend-mode:overlay;opacity:.5;background-image:radial-gradient(circle at 1px 1px,rgba(255,255,255,.5) 1px,transparent 0);background-size:3px 3px;}
.portrait .vig{position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 30%,transparent 50%,rgba(40,20,10,.42));}
.portrait .ph{position:absolute;left:18px;bottom:16px;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.82);}
.bioscan{position:absolute;right:-22px;bottom:26px;width:min(300px,84%);background:var(--paper);border:1px solid var(--rule);border-radius:14px;padding:22px 22px 18px;box-shadow:0 30px 70px -30px rgba(20,16,25,.4);}
@media(max-width:920px){.bioscan{position:relative;right:0;bottom:0;width:100%;margin-top:16px;}}
.bioscan::after{content:'';position:absolute;top:-1px;left:22px;right:22px;height:2px;background:var(--seam);border-radius:0 0 2px 2px;}
.bs-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;}
.bs-label{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);}
.bs-live{display:inline-flex;align-items:center;gap:7px;font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--recovery-deep);}
.bs-dot{width:7px;height:7px;border-radius:50%;background:var(--recovery);position:relative;}
.bs-dot::after{content:'';position:absolute;inset:-4px;border-radius:50%;border:1px solid var(--recovery);opacity:.5;animation:pulse 2.2s infinite;}
@keyframes pulse{0%{transform:scale(1);opacity:.5;}70%{transform:scale(1.9);opacity:0;}100%{opacity:0;}}
.bs-reads{display:flex;gap:22px;align-items:flex-end;margin-bottom:18px;flex-wrap:wrap;}
.bs-read small{display:block;font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);margin-bottom:5px;}
.bs-read .v{font-family:var(--mono);font-weight:600;font-size:33px;line-height:1;}
.bs-read.now .v{color:var(--heat-text);}
.bs-read.gap{margin-left:auto;text-align:right;}
.bs-read.gap .v{font-size:25px;color:var(--heat-text);}
.bs-bars{display:flex;flex-direction:column;gap:10px;padding-top:18px;border-top:1px solid var(--rule);}
.bs-bar{display:grid;grid-template-columns:80px 1fr;align-items:center;gap:12px;}
.bs-bar .k{font-family:var(--mono);font-size:10px;color:var(--ink-3);}
.bs-track{height:8px;border-radius:8px;background:var(--bone-deep);overflow:hidden;}
.bs-fill{height:100%;width:0;border-radius:8px;transition:width 1.6s cubic-bezier(.22,1,.36,1);}
.reveal.in .bs-fill{width:var(--w);}
.bs-fill.heat{background:linear-gradient(90deg,#FF8A6B,var(--heat));}
.bs-fill.rec{background:linear-gradient(90deg,var(--recovery),#7FC0EE);}

/* generic grids/cards */
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:42px;}
@media(max-width:760px){.grid3{grid-template-columns:1fr;}}
.symptom{border:1px solid var(--rule);border-radius:12px;padding:24px 22px;background:var(--bone);}
.symptom h3{font-family:var(--serif);font-size:19px;font-weight:500;margin-bottom:6px;}
.symptom .b{font-size:14px;color:var(--ink-3);line-height:1.5;}
.symptom .tag{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--heat-text);margin-bottom:14px;display:flex;align-items:center;gap:8px;}
.symptom .tag::before{content:'';width:18px;height:2px;background:var(--heat-text);}

/* teaser */
.teaser{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid var(--rule);border-radius:16px;overflow:hidden;margin-top:8px;background:var(--paper);}
@media(max-width:760px){.teaser{grid-template-columns:1fr;}}
.teaser-art{position:relative;min-height:300px;background:radial-gradient(120% 80% at 30% 20%,#FFC9A3,transparent 50%),linear-gradient(158deg,#5A1B0C,#C23E1E 55%,#FF5E3A);display:flex;align-items:center;justify-content:center;}
.teaser-play{width:78px;height:78px;border-radius:50%;background:rgba(252,250,245,.92);display:flex;align-items:center;justify-content:center;box-shadow:0 18px 40px rgba(0,0,0,.3);transition:transform .2s;}
.teaser-art:hover .teaser-play{transform:scale(1.06);}
.teaser-play svg{color:var(--heat-text);margin-left:3px;}
.teaser-body{padding:clamp(32px,5vw,48px);display:flex;flex-direction:column;justify-content:center;}
.teaser-body h3{font-family:var(--serif);font-size:clamp(24px,3.5vw,34px);line-height:1.08;letter-spacing:-.01em;margin-bottom:14px;}
.teaser-body p{font-size:15px;color:var(--ink-3);line-height:1.6;margin-bottom:24px;max-width:42ch;}

/* measure dark */
.measure{background:var(--slate);color:#EAF1F0;position:relative;overflow:hidden;}
.constellation{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:.55;z-index:0;}
.cn-hero circle{animation:cnPulse 7s var(--ease-io) infinite;}
.cn-hero circle:nth-child(2){animation-delay:1.4s;}
.cn-hero circle:nth-child(3){animation-delay:2.8s;}
.cn-hero circle:nth-child(4){animation-delay:4.2s;}
@keyframes cnPulse{0%,100%{opacity:1;}50%{opacity:.42;}}
.measure .sec-label{color:var(--slate-mut);}.measure .sec-label::before{background:var(--slate-mut);}
.measure .sec-label .num{color:var(--recovery);}
.measure h2.sec{color:#F4F1EA;}.measure h2.sec em{font-style:italic;color:var(--gold-soft);}
.measure .sec-sub{color:var(--gold-soft);}
.miage-block{display:grid;grid-template-columns:1.05fr .95fr;gap:18px;margin-top:44px;align-items:stretch;}
@media(max-width:840px){.miage-block{grid-template-columns:1fr;}}
.miage-hero{background:linear-gradient(158deg,var(--slate-2),#0B1622);border:1px solid var(--slate-line);border-radius:18px;padding:clamp(28px,4vw,40px);position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:center;}
.miage-hero::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--seam);}
.mh-label{font-family:var(--mono);font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--gold-soft);}
.mh-beta{display:inline-block;font-family:var(--mono);font-size:9.5px;font-weight:700;letter-spacing:.12em;padding:2px 7px;margin-left:6px;border-radius:100px;border:1px solid var(--gold-soft);color:var(--gold-soft);vertical-align:middle;}
.mh-num{font-family:var(--serif);font-size:clamp(64px,12vw,108px);line-height:.9;letter-spacing:-.03em;margin:12px 0 18px;color:#F4F1EA;}
.mh-num span{font-size:.28em;color:var(--slate-mut);margin-left:8px;font-family:var(--mono);letter-spacing:0;}
.mh-desc{font-size:15px;line-height:1.6;color:#C7D2DC;max-width:42ch;}
.miage-method{margin-top:20px;border:1px solid var(--slate-line);border-radius:14px;padding:20px 24px;background:rgba(255,255,255,.03);}
.mm-label{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-soft);}
.miage-method p{font-size:13.5px;line-height:1.62;color:#B8C6D6;margin:8px 0 0;max-width:92ch;}
.miage-method b{color:#EAF1F0;font-weight:600;}
.miage-method sup a{color:var(--gold-soft);}
.tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:28px;}
.tier{border:1px solid var(--rule);border-radius:16px;padding:26px 24px;background:var(--paper);display:flex;flex-direction:column;}
.tier-mid{border-color:var(--blue);box-shadow:0 24px 60px -40px rgba(6,8,169,.4);}
.tier-h{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:16px;}
.tier-name{font-family:var(--serif);font-size:22px;color:var(--ink);}
.tier-tag{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold-text);}
.tier-list{list-style:none;padding:0;margin:0 0 18px;display:flex;flex-direction:column;gap:8px;flex:1;}
.tier-list li{font-size:13.5px;color:var(--ink-3);padding-left:16px;position:relative;line-height:1.4;}
.tier-list li::before{content:"";position:absolute;left:0;top:8px;width:5px;height:5px;border-radius:50%;background:var(--gold-soft);}
.tier-claim{font-size:13.5px;line-height:1.5;color:var(--ink);margin:0 0 14px;}
.tier-conf{font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--blue);font-weight:600;margin-top:auto;}
.tier-note{font-family:var(--mono);font-size:11.5px;color:var(--ink-4);margin-top:20px;line-height:1.5;text-align:center;}
@media(max-width:820px){.tiers{grid-template-columns:1fr;}}
.proto-cat{display:inline-block;font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-text);margin-bottom:10px;}
.ladder{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
.plan{border:1px solid var(--rule);border-radius:16px;padding:26px 22px;background:var(--paper);display:flex;flex-direction:column;position:relative;}
.plan-peak{border-color:var(--blue);box-shadow:0 26px 64px -42px rgba(6,8,169,.45);}
.plan-tag{position:absolute;top:-11px;left:22px;font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;background:var(--ink);color:var(--paper);padding:4px 10px;border-radius:999px;}
.plan-peak .plan-tag{background:var(--blue);}
.plan-name{font-family:var(--serif);font-size:26px;color:var(--ink);}
.plan-phase{font-family:var(--mono);font-size:12px;color:var(--ink-3);margin-bottom:16px;}
.plan-cap{font-family:var(--serif);font-size:44px;font-weight:600;color:var(--ink);line-height:1;}
.plan-cap span{font-family:var(--mono);font-size:14px;font-weight:400;color:var(--ink-3);}
.plan-total{font-family:var(--mono);font-size:13px;color:var(--ink-3);margin:6px 0 18px;}
.plan-btn{margin-top:auto;width:100%;justify-content:center;}
.trial-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:22px;padding-top:22px;border-top:1px solid var(--rule);}
.trial-lbl{font-family:var(--mono);font-size:12px;color:var(--ink-3);margin-right:4px;}
.trial-opt{display:inline-flex;align-items:center;gap:10px;border:1px solid var(--rule);border-radius:10px;padding:10px 16px;background:transparent;cursor:pointer;transition:background .2s var(--ease);}
.trial-opt:hover{background:var(--bone);}
.trial-nm{font-size:14px;color:var(--ink);}
.trial-pr{font-family:var(--mono);font-size:14px;font-weight:600;color:var(--blue);}
@media(max-width:820px){.ladder{grid-template-columns:1fr;}}
.phase-legend{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;}
.phase-item{display:flex;gap:12px;align-items:flex-start;}
.phase-n{flex:none;width:26px;height:26px;border-radius:50%;background:var(--ink);color:var(--paper);font-family:var(--mono);font-size:12px;display:flex;align-items:center;justify-content:center;}
.phase-item b{font-family:var(--serif);font-size:17px;color:var(--ink);display:block;margin-bottom:2px;}
.phase-item p{font-size:12.5px;color:var(--ink-3);line-height:1.4;margin:0;}
.plan-track{display:flex;gap:5px;margin:16px 0 8px;}
.plan-track .seg{flex:1;height:5px;border-radius:3px;background:var(--rule);}
.plan-track .seg.on{background:linear-gradient(90deg,var(--heat),var(--recovery));}
.plan-reach{font-family:var(--mono);font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3);margin-bottom:16px;}
@media(max-width:820px){.phase-legend{grid-template-columns:1fr;}}
.plan-blurb{font-size:12.5px;line-height:1.45;color:var(--ink-3);margin:0 0 16px;}
.assure{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:30px;padding-top:26px;border-top:1px solid var(--rule);}
.assure-item{display:flex;gap:11px;align-items:flex-start;}
.assure-ic{flex:none;color:var(--blue);margin-top:1px;}
.assure-item b{display:block;font-size:14px;color:var(--ink);margin-bottom:3px;}
.assure-item span{font-size:12.5px;color:var(--ink-3);line-height:1.45;}
@media(max-width:820px){.assure{grid-template-columns:1fr;}}
.field.err input{border-color:var(--heat-text);}
.field-err{display:block;font-size:11.5px;color:var(--heat-text);margin-top:5px;font-family:var(--mono);letter-spacing:.02em;}
.co-error{margin-top:12px;background:rgba(181,67,31,.08);border:1px solid rgba(181,67,31,.32);color:var(--heat-text);border-radius:10px;padding:11px 14px;font-size:13px;line-height:1.4;}
.co-place:disabled,.co-paybar button:disabled{opacity:.55;cursor:not-allowed;}
.co-banner{background:rgba(181,67,31,.08);border:1px solid rgba(181,67,31,.3);color:var(--heat-text);border-radius:10px;padding:11px 14px;font-size:13px;margin-bottom:20px;font-weight:500;}
.exp-btn.on{border-color:var(--ink);background:var(--ink);color:var(--paper);}
.co-review{border:1px solid var(--rule);border-radius:12px;padding:14px 16px;margin:16px 0 4px;background:var(--bone);}
.co-review:focus{outline:2px solid var(--blue);outline-offset:2px;}
.cr-head{display:flex;justify-content:space-between;align-items:center;font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);margin-bottom:10px;}
.cr-edit{background:none;border:none;color:var(--blue);font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;text-decoration:underline;padding:0;}
.cr-row{display:flex;gap:12px;padding:6px 0;font-size:13px;border-top:1px solid var(--rule);}
.cr-row:first-of-type{border-top:none;}
.cr-k{flex:none;width:78px;color:var(--ink-3);}
.cr-v{color:var(--ink);line-height:1.5;}
.co-deliver{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--ink-3);margin-top:14px;}
.card-fields{margin-top:16px;padding-top:16px;border-top:1px solid var(--rule);}
.card-note{display:flex;align-items:flex-start;gap:7px;font-size:11.5px;color:var(--ink-3);line-height:1.45;margin-top:2px;}
.card-note svg{flex:none;margin-top:1px;}
.ref-row{display:flex;gap:10px;}
.ref-row input{flex:1;padding:12px 14px;border:1px solid var(--rule);border-radius:10px;font-size:14px;font-family:inherit;background:var(--paper);color:var(--ink);}
.ref-apply{flex:none;padding:0 20px;border:1px solid var(--ink);background:var(--paper);color:var(--ink);border-radius:10px;font-family:var(--mono);font-size:12px;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;}
.ref-apply:disabled{opacity:.5;cursor:not-allowed;}
.ref-applied{display:flex;justify-content:space-between;align-items:center;gap:12px;background:var(--bone);border:1px solid var(--rule);border-radius:10px;padding:11px 14px;font-size:13px;}
.ref-applied button{background:none;border:none;color:var(--blue);font-size:12px;cursor:pointer;text-decoration:underline;flex:none;}
.ref-msg{font-size:12px;color:var(--heat-text);margin-top:8px;}
.ref-msg.ok{color:var(--recovery-deep);}
.sum-row.disc span:last-child{color:var(--recovery-deep);}
.doors-soon{border:1px dashed var(--rule);border-radius:16px;padding:52px 32px;text-align:center;background:var(--paper);}
.soon-badge{display:inline-block;font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-text);border:1px solid var(--rule);border-radius:999px;padding:5px 14px;margin-bottom:16px;}
.doors-soon h3{font-family:var(--serif);font-size:22px;color:var(--ink);margin:0 0 8px;}
.doors-soon p{font-size:14px;color:var(--ink-3);margin:0 auto;max-width:44ch;}
.miage-supports{display:flex;flex-direction:column;gap:18px;}
.ms-card{background:var(--slate-2);border:1px solid var(--slate-line);border-radius:16px;padding:24px 26px;flex:1;display:flex;flex-direction:column;justify-content:center;}
.ms-name{font-family:var(--serif);font-size:20px;font-weight:500;color:#F4F1EA;margin-bottom:9px;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}
.ms-name small{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--slate-mut);}
.ms-card p{font-size:14.5px;line-height:1.55;color:#AEBCC9;}
.measure-link{display:inline-flex;align-items:center;gap:10px;margin-top:28px;font-size:15px;font-weight:600;color:var(--recovery);transition:color .2s,gap .2s;}
.measure-link:hover{color:var(--gold-soft);gap:14px;}
.measure-link svg{flex-shrink:0;}
/* how the blood scan works */
.sub-h{font-family:var(--serif);font-weight:500;font-size:clamp(22px,3vw,28px);letter-spacing:-.01em;}
.howscan{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:6px;}
@media(max-width:860px){.howscan{grid-template-columns:1fr 1fr;}}
@media(max-width:520px){.howscan{grid-template-columns:1fr;}}
.howstep{background:var(--paper);border:1px solid var(--rule);border-radius:14px;padding:22px 20px;}
.hs-n{width:30px;height:30px;border-radius:50%;background:var(--blue);color:var(--bone);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:13px;font-weight:600;margin-bottom:14px;}
.howstep h4{font-family:var(--serif);font-weight:500;font-size:17px;margin-bottom:7px;}
.howstep p{font-size:13.5px;line-height:1.5;color:var(--ink-2);}
.dual .full{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-4);margin:3px 0 2px;}
.stack{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:44px;}
@media(max-width:760px){.stack{grid-template-columns:1fr;}}
.node{background:var(--slate-2);border:1px solid var(--slate-line);border-radius:14px;padding:26px 24px;}
.node .step{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.08em;color:var(--recovery);margin-bottom:14px;}
.node h3{font-family:var(--serif);font-size:22px;font-weight:500;margin-bottom:8px;color:#F4F1EA;}
.node p{font-size:13.5px;color:var(--slate-mut);line-height:1.55;}
.traj{margin-top:24px;background:var(--slate-2);border:1px solid var(--slate-line);border-radius:16px;padding:clamp(22px,4vw,32px);box-shadow:0 30px 60px -30px rgba(0,0,0,.6);}
.traj-top{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;}
.traj-top .t{font-family:var(--serif);font-style:italic;font-size:20px;color:#F4F1EA;}
.traj-lbi{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--slate-mut);}
.traj-delta{display:flex;align-items:flex-end;gap:14px 26px;flex-wrap:wrap;margin-top:20px;}
.td-main{display:flex;align-items:baseline;gap:11px;}
.td-main b{font-family:var(--serif);font-weight:400;font-size:clamp(40px,8vw,56px);line-height:.9;color:#79CBF5;}
.td-main span{font-family:var(--mono);font-size:10.5px;line-height:1.45;letter-spacing:.05em;text-transform:uppercase;color:var(--slate-mut);}
.td-flow{display:flex;align-items:center;gap:9px;font-family:var(--serif);font-size:23px;color:#F4F1EA;flex-wrap:wrap;}
.td-flow svg{color:var(--slate-mut);}
.td-flow small{flex-basis:100%;font-family:var(--sans);font-size:12.5px;color:var(--slate-mut);margin-top:1px;}
.traj-plot{position:relative;height:clamp(172px,34vw,216px);margin-top:24px;}
.traj-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}
.traj-svg polyline{stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 1.9s cubic-bezier(.4,0,.2,1);}
.reveal.in .traj-svg polyline{stroke-dashoffset:0;}
.traj-cal{position:absolute;right:0;transform:translateY(-50%);font-family:var(--mono);font-size:10px;letter-spacing:.05em;color:var(--slate-mut);background:var(--slate-2);padding:1px 6px;border-radius:4px;}
.traj-pt{position:absolute;transform:translate(-50%,-50%);pointer-events:none;}
.tp-dot{display:block;width:11px;height:11px;border-radius:50%;border:2px solid;background:var(--slate-2);box-sizing:border-box;}
.traj-pt.last .tp-dot{width:15px;height:15px;box-shadow:0 0 0 4px rgba(121,203,245,.16);}
.tp-val{position:absolute;left:50%;bottom:calc(100% + 7px);transform:translateX(-50%);font-family:var(--mono);font-size:13px;font-weight:600;white-space:nowrap;}
.traj-pt.last .tp-val{font-size:16px;}
.traj-x{position:relative;height:36px;margin-top:14px;}
.traj-x span{position:absolute;display:flex;flex-direction:column;gap:3px;font-family:var(--mono);font-size:11px;color:var(--slate-mut);white-space:nowrap;}
.traj-x small{font-family:var(--sans);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--recovery);}
.traj-ex{margin-top:6px;font-size:12px;color:var(--slate-mut);line-height:1.5;font-style:italic;}
.traj-note{margin-top:14px;font-size:14px;color:#B8C6D6;line-height:1.6;max-width:62ch;}
.traj-note b{color:#F4F1EA;font-weight:600;}
/* Story of Hope — before/after MiAge testimonial */
.soh-section{background:var(--bone);}
.soh{display:grid;grid-template-columns:minmax(300px,380px) 1fr;background:var(--paper);border:1px solid var(--rule);border-radius:24px;overflow:hidden;box-shadow:0 44px 100px -55px rgba(20,16,25,.45);margin-top:26px;}
.soh-portrait{position:relative;background:linear-gradient(150deg,#16283E,#0B1420);color:#F4F1EA;padding:28px;display:flex;flex-direction:column;min-height:540px;}
.soh-eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold-soft);text-align:center;}
.soh-photo{flex:1;margin:18px 0;border-radius:16px;background:radial-gradient(120% 78% at 50% 34%,#26405C,transparent 62%),#152740;display:flex;align-items:center;justify-content:center;min-height:210px;}
.soh-photo span{font-family:var(--mono);font-size:11px;letter-spacing:.12em;color:#7E93AB;background:rgba(11,20,32,.55);padding:5px 12px;border-radius:999px;}
.soh-q{font-family:var(--serif);font-style:italic;font-size:23px;line-height:1.25;color:#F4F1EA;margin:0 0 13px;}
.soh-rule{display:block;width:44px;height:2px;background:var(--gold-soft);margin-bottom:14px;}
.soh-name{font-family:var(--serif);font-size:22px;}
.soh-metar{font-family:var(--mono);font-size:13px;color:#B8C6D6;margin-top:4px;}
.soh-metar b{color:#3FBF6A;}
.soh-ph{font-family:var(--mono);font-size:10.5px;color:#63788F;margin-top:9px;}
.soh-proof{padding:clamp(24px,4vw,42px);}
.soh-h{font-family:var(--serif);font-size:clamp(28px,4vw,40px);font-weight:400;margin:0;color:var(--ink);letter-spacing:-.01em;}
.soh-h em{font-style:normal;font-weight:600;}
.soh-tether{font-family:var(--mono);font-size:11.5px;letter-spacing:.05em;color:var(--ink-3);margin-top:7px;text-transform:uppercase;}
.soh-nums{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:28px 0 4px;}
.soh-col{text-align:center;flex:1;min-width:0;}
.soh-when{font-family:var(--mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-3);}
.soh-mi{font-family:var(--serif);font-size:clamp(58px,9vw,104px);font-weight:600;line-height:1;margin:4px 0 6px;}
.soh-mi.heat{color:var(--heat-text);}
.soh-mi.rec{color:var(--recovery);}
.soh-sub{font-family:var(--mono);font-size:12px;color:var(--ink-3);}
.soh-arrow{display:flex;flex-direction:column;align-items:center;gap:9px;flex:none;padding:0 2px;}
.soh-mo{font-family:var(--mono);font-size:11px;color:var(--gold-text);white-space:nowrap;}
.soh-seam{width:clamp(36px,7vw,88px);height:4px;border-radius:2px;background:var(--seam);}
.soh-win{font-family:var(--serif);font-size:clamp(24px,3.4vw,34px);font-weight:400;margin:24px 0 4px;color:var(--ink);}
.soh-win em{font-style:normal;font-weight:600;color:#2E9E52;}
.soh-gap{font-family:var(--mono);font-size:14px;color:var(--ink-3);margin:0;}
.soh-gap b{color:#2E9E52;}
.soh-labs{margin-top:22px;border-top:1px solid var(--rule);padding-top:18px;display:flex;flex-direction:column;gap:9px;font-family:var(--mono);font-size:14px;color:var(--ink);}
.soh-labs span{color:var(--ink-3);display:inline-block;width:52px;}
.soh-labs .heat{color:var(--heat-text);font-weight:600;}
.soh-labs .rec{color:var(--recovery);font-weight:600;}
.soh-long{font-family:var(--serif);font-style:italic;font-size:18px;color:var(--ink-2);margin:20px 0 0;}
.soh-caveat{font-family:var(--mono);font-size:11.5px;color:var(--ink-4);margin-top:20px;border-top:1px solid var(--rule);padding-top:16px;line-height:1.5;}
@media(max-width:760px){.soh{grid-template-columns:1fr;}.soh-portrait{min-height:auto;}}

/* protocol */
.proto-grid{display:grid;grid-template-columns:.9fr 1.1fr;gap:48px;align-items:center;margin-top:44px;}
@media(max-width:880px){.proto-grid{grid-template-columns:1fr;gap:32px;}}
.product{position:relative;border-radius:18px;overflow:hidden;aspect-ratio:1/1;border:1px solid var(--rule);background:radial-gradient(120% 80% at 30% 20%,#CBE6F7,transparent 50%),linear-gradient(158deg,#082234,#1E5E8C 55%,#2F86C9);display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 36px 80px -44px rgba(20,16,25,.5);}
.product .bottle{font-family:var(--serif);font-size:clamp(28px,4vw,40px);color:#fff;letter-spacing:-.01em;}
.product .plus{font-family:var(--mono);font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.82);margin-top:6px;}
.product .spec{position:absolute;bottom:18px;left:0;right:0;text-align:center;font-family:var(--mono);font-size:10px;letter-spacing:.06em;color:rgba(255,255,255,.7);}
.prod-cap{width:80%;height:auto;margin-bottom:14px;filter:drop-shadow(0 16px 30px rgba(0,0,0,.4));}
.thumb-cap{width:100%;height:100%;object-fit:contain;}
.steps{display:flex;flex-direction:column;border-top:1px solid var(--rule);}
.step-row{display:flex;gap:18px;padding:22px 0;border-bottom:1px solid var(--rule);align-items:flex-start;}
.step-n{font-family:var(--serif);font-style:italic;font-size:30px;color:var(--blue);line-height:1;flex-shrink:0;width:42px;}
.step-tx h3{font-family:var(--serif);font-size:20px;font-weight:500;margin-bottom:5px;}
.step-tx p{font-size:14.5px;color:var(--ink-3);line-height:1.55;}

/* proof */
.testi-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:44px;}
@media(max-width:760px){.testi-grid{grid-template-columns:1fr;}}
.testi{background:var(--bone);border:1px solid var(--rule);border-radius:14px;padding:32px 30px;display:flex;flex-direction:column;}
.testi .q{font-family:var(--serif);font-size:20px;line-height:1.45;color:var(--ink);margin-bottom:24px;flex:1;}
.testi .q::before{content:'\\201C';font-family:var(--serif);font-size:46px;line-height:0;color:var(--gold);vertical-align:-12px;margin-right:2px;}
.testi .who{display:flex;align-items:center;gap:14px;padding-top:20px;border-top:1px solid var(--rule);}
.testi .av{width:48px;height:48px;border-radius:50%;flex-shrink:0;background:radial-gradient(120% 80% at 30% 20%,#F7E6CC,transparent 55%),linear-gradient(158deg,#E9CBA6,#9E6A48);display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:18px;color:rgba(255,255,255,.92);box-shadow:inset 0 1px 0 rgba(255,255,255,.4);}
.testi .nm{font-size:15px;font-weight:600;}
.testi .role{font-size:13px;color:var(--ink-3);margin-top:2px;}
.hope{margin-top:24px;display:grid;grid-template-columns:auto 1fr auto;gap:24px;align-items:center;background:var(--bone);border:1px solid var(--gold-soft);border-radius:14px;padding:26px 30px;box-shadow:0 18px 44px -28px rgba(176,141,91,.4);}
@media(max-width:760px){.hope{grid-template-columns:1fr;gap:16px;}}
.hope .badge{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-text);border:1px solid var(--gold-soft);border-radius:100px;padding:8px 14px;white-space:nowrap;}
.hope h3{font-family:var(--serif);font-size:21px;font-weight:500;margin-bottom:4px;}
.hope .b{font-size:14px;color:var(--ink-3);line-height:1.5;}

/* trust */
.trust{padding:clamp(36px,5vw,52px) 0;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);}
.trust-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:24px;text-align:center;}
@media(max-width:760px){.trust-grid{grid-template-columns:repeat(2,1fr);gap:28px 18px;}.trust-item:last-child{grid-column:1/-1;}}
.trust-item .n{font-family:var(--serif);font-size:clamp(24px,3.4vw,34px);color:var(--blue);line-height:1;letter-spacing:-.02em;}
.trust-item .l{font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin-top:9px;line-height:1.4;}

/* doors */
.doors{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:44px;}
@media(max-width:760px){.doors{grid-template-columns:1fr;}}
.door{border:1px solid var(--rule);border-radius:14px;padding:30px 28px;background:var(--paper);transition:transform .2s,box-shadow .3s,border-color .2s;display:flex;flex-direction:column;}
.door:hover{transform:translateY(-3px);box-shadow:0 22px 50px -28px rgba(20,16,25,.22);border-color:var(--gold-soft);}
.door .ic{width:46px;height:46px;border-radius:12px;border:1px solid var(--rule);display:flex;align-items:center;justify-content:center;color:var(--blue);margin-bottom:18px;}
.door h3{font-family:var(--serif);font-size:21px;font-weight:500;margin-bottom:7px;}
.door p{font-size:14px;color:var(--ink-3);line-height:1.55;margin-bottom:20px;flex:1;}
.door .lnk{font-size:14px;font-weight:600;color:var(--blue);display:inline-flex;align-items:center;gap:8px;min-height:32px;}

/* final */
.final{background:var(--blue);color:var(--bone);text-align:center;position:relative;overflow:hidden;padding:clamp(56px,10vw,112px) 0;}
.final::before{content:'';position:absolute;top:-30%;right:-10%;width:600px;height:600px;background:radial-gradient(circle,rgba(176,141,91,.2),transparent 60%);pointer-events:none;}
.final-in{position:relative;z-index:1;}
.final .lab{font-family:var(--serif);font-style:italic;font-size:18px;color:var(--gold-soft);margin-bottom:18px;}
.final h2{font-family:var(--serif);font-weight:400;font-size:clamp(34px,7vw,68px);line-height:1;letter-spacing:-.025em;max-width:16ch;margin:0 auto 22px;}
.final h2 em{font-style:italic;color:var(--gold-soft);}
.final p{font-size:16px;color:rgba(244,241,234,.82);max-width:42ch;margin:0 auto 32px;line-height:1.55;}

/* compliance + footer */
.compliance{background:var(--paper);border:1px solid var(--gold-soft);border-radius:12px;padding:28px 30px;margin-top:46px;display:grid;grid-template-columns:auto 1fr;gap:22px;align-items:center;box-shadow:0 18px 44px -28px rgba(176,141,91,.4);}
@media(max-width:600px){.compliance{grid-template-columns:1fr;}}
.comp-seal{width:60px;height:60px;border-radius:50%;border:2px solid var(--gold);display:flex;align-items:center;justify-content:center;color:var(--gold-text);flex-shrink:0;}
.comp-txt h3{font-family:var(--serif);font-size:18px;font-weight:500;margin-bottom:5px;}
.comp-txt .b{font-size:14px;color:var(--ink-3);line-height:1.55;}
.comp-txt .b em{font-style:italic;color:var(--heat-text);font-weight:500;}
footer{padding:54px 0;border-top:1px solid var(--rule);}
.foot-inner{display:flex;flex-wrap:wrap;justify-content:space-between;gap:24px;align-items:flex-start;}
.foot-brand .g{font-family:var(--serif);font-size:24px;}
.foot-brand .cry{font-family:var(--serif);font-style:italic;font-size:14px;color:var(--gold-text);margin-top:4px;}
.foot-nav{display:flex;gap:30px;flex-wrap:wrap;}
.foot-nav a{font-size:13px;color:var(--ink-2);}
.foot-nav a:hover{color:var(--blue);}
.foot-legal{font-family:var(--mono);font-size:11px;color:var(--ink-3);text-align:right;line-height:1.7;}
.sitemap{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:22px 24px;padding-bottom:34px;margin-bottom:34px;border-bottom:1px solid var(--rule);}
.smap-head{display:flex;flex-direction:column;gap:3px;font-weight:600;font-size:14px;color:var(--ink);margin-bottom:13px;}
.smap-head:hover{color:var(--blue);}
.smap-col.here .smap-head{color:var(--blue);}
.smap-you{font-family:var(--mono);font-size:9px;letter-spacing:.09em;text-transform:uppercase;color:var(--gold-text);}
.smap-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px;}
.smap-sec{background:none;border:0;padding:0;text-align:left;cursor:pointer;font-family:inherit;font-size:12.5px;line-height:1.3;color:var(--ink-3);transition:color .2s;}
.smap-sec:hover{color:var(--blue);}
.nav-lead{display:flex;align-items:center;gap:10px;min-width:0;}
.nav-here{display:none;font-family:var(--mono);font-size:12px;font-weight:600;letter-spacing:.03em;color:var(--blue);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.nav-here::before{content:"/ ";color:var(--ink-4);}
@media(max-width:860px){.nav-here{display:block;}}
@media(max-width:680px){.foot-inner{flex-direction:column;}.foot-legal{text-align:left;}.sitemap{grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 18px;}}

/* shop */
.price{font-family:var(--mono);font-weight:600;font-size:28px;color:var(--ink);}
.price .was{font-size:14px;color:var(--ink-4);text-decoration:line-through;margin-left:10px;font-weight:500;}
.price .ph{font-size:11px;color:var(--ink-4);margin-left:8px;}
.inside{list-style:none;margin:22px 0;display:flex;flex-direction:column;gap:10px;}
.inside li{display:flex;gap:11px;font-size:14.5px;color:var(--ink-2);align-items:flex-start;}
.inside li svg{color:var(--recovery-deep);flex-shrink:0;margin-top:3px;}
.prodcard{border:1px solid var(--rule);border-radius:14px;overflow:hidden;background:var(--paper);display:flex;flex-direction:column;transition:transform .2s,box-shadow .3s,border-color .2s;}
.prodcard:hover{transform:translateY(-3px);box-shadow:0 22px 50px -28px rgba(20,16,25,.22);border-color:var(--gold-soft);}
.prodcard .art{aspect-ratio:4/3;background:radial-gradient(120% 80% at 30% 20%,#CBE6F7,transparent 55%),linear-gradient(158deg,#0E3450,#2F86C9);position:relative;}
.prodcard .art .nm{position:absolute;left:18px;bottom:14px;font-family:var(--serif);font-size:21px;color:#fff;}
.prodcard .meta{padding:20px 22px;display:flex;flex-direction:column;flex:1;}
.prodcard .meta p{font-size:13.5px;color:var(--ink-3);line-height:1.5;margin:6px 0 16px;flex:1;}
.prodcard .row{display:flex;align-items:center;justify-content:space-between;gap:12px;}
.prodcard .price{font-size:20px;}

/* lca / physicians */
.lca-hero{padding:140px 0 64px;background:var(--bone);position:relative;overflow:hidden;}
.lca-hero.dark{background:var(--slate);color:#EAF1F0;}
.lca-hero.dark .eyebrow{color:var(--gold-soft);}.lca-hero.dark .eyebrow::before{background:var(--gold-soft);}
.lca-hero.dark h1{color:#F4F1EA;}.lca-hero.dark h1 em{color:var(--gold-soft);}
.lca-hero.dark .hero-lede{color:rgba(234,241,240,.82);}
.lca-hero .narrow{max-width:760px;}
.offer-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border-top:1px solid var(--rule);margin-top:44px;}
@media(max-width:720px){.offer-grid{grid-template-columns:1fr;}}
.offer{display:flex;gap:16px;padding:26px 0;border-bottom:1px solid var(--rule);align-items:flex-start;}
.offer:nth-child(odd){border-right:1px solid var(--rule);padding-right:36px;}
@media(max-width:720px){.offer:nth-child(odd){border-right:0;padding-right:0;}}
.offer:nth-child(even){padding-left:36px;}
@media(max-width:720px){.offer:nth-child(even){padding-left:0;}}
.offer .ck{flex-shrink:0;width:28px;height:28px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;color:var(--bone);margin-top:2px;}
.offer h3{font-size:17px;font-weight:600;margin-bottom:4px;}
.offer p{font-size:14px;color:var(--ink-3);line-height:1.5;}

/* nav login (secondary) */
.nav-login{font-size:14px;font-weight:600;color:var(--ink-3);display:inline-flex;align-items:center;gap:6px;padding:6px 0;}
.nav-login:hover{color:var(--blue);}
@media(max-width:860px){.nav-inner>.nav-login{display:none;}}
.sheet .sheet-login{font-family:var(--sans);font-size:15px;font-weight:500;color:var(--ink-3);border-bottom:0;padding:14px 0 0;}
.sheet .sheet-login:hover{color:var(--blue);}

/* system — the stack */
.layers{display:flex;flex-direction:column;gap:14px;margin-top:44px;}
.layer{display:grid;grid-template-columns:auto 1fr auto;gap:26px;align-items:center;border:1px solid var(--rule);border-radius:14px;padding:26px 28px;background:var(--paper);transition:border-color .2s,transform .2s;}
.layer:hover{border-color:var(--gold-soft);transform:translateY(-2px);}
@media(max-width:760px){.layer{grid-template-columns:auto 1fr;gap:16px 18px;}.layer .who{grid-column:2;justify-self:start;}}
.layer .lnum{font-family:var(--serif);font-style:italic;font-size:34px;color:var(--blue);line-height:1;}
.layer h3{font-family:var(--serif);font-size:23px;font-weight:500;margin-bottom:6px;color:var(--ink);}
.layer h3 .sub{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3);margin-left:10px;vertical-align:middle;}
.layer p{font-size:14.5px;color:var(--ink-3);line-height:1.55;max-width:64ch;}
.layer .who{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;padding:7px 13px;border-radius:100px;border:1px solid var(--rule);color:var(--ink-2);}
.layer .who.pt{color:var(--heat-text);border-color:var(--gold-soft);}
.layer .who.md{color:var(--recovery-deep);}

/* system — two honest readings */
.dual{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:44px;}
@media(max-width:760px){.dual{grid-template-columns:1fr;}}
.dual .col{border:1px solid var(--rule);border-radius:14px;padding:30px 28px;background:var(--paper);}
.dual .col .tag{font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;margin-bottom:16px;display:flex;align-items:center;gap:9px;}
.dual .col.pt .tag{color:var(--heat-text);}.dual .col.pt .tag::before{content:'';width:20px;height:2px;background:var(--heat-text);}
.dual .col.md .tag{color:var(--recovery-deep);}.dual .col.md .tag::before{content:'';width:20px;height:2px;background:var(--recovery-deep);}
.dual .col h3{font-family:var(--serif);font-size:23px;font-weight:500;margin-bottom:10px;}
.dual .col .big{font-family:var(--mono);font-weight:600;font-size:42px;line-height:1;margin-bottom:10px;}
.dual .col.pt .big{color:var(--heat-text);}.dual .col.md .big{color:var(--recovery-deep);}
.dual .col p{font-size:14.5px;color:var(--ink-3);line-height:1.55;}
.vault{margin-top:22px;display:flex;gap:14px;align-items:center;font-size:13.5px;color:var(--ink-3);line-height:1.5;border:1px dashed var(--gold-soft);border-radius:12px;padding:18px 22px;background:var(--bone);}
.vault svg{color:var(--gold-text);flex-shrink:0;}

/* lifestyle triggers */
.triggers{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:44px;}
@media(max-width:760px){.triggers{grid-template-columns:1fr;}}
.trigger{border:1px solid var(--rule);border-radius:12px;padding:24px 22px;background:var(--paper);transition:border-color .2s,transform .2s;}
.trigger:hover{border-color:var(--gold-soft);transform:translateY(-2px);}
.trigger .tnum{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.12em;color:var(--heat-text);margin-bottom:12px;}
.trigger h3{font-family:var(--serif);font-size:19px;font-weight:500;margin-bottom:7px;}
.trigger .tstat{font-family:var(--serif);font-size:22px;font-weight:500;line-height:1.05;color:var(--heat-text);margin:2px 0 11px;letter-spacing:-.01em;}
.trigger .tstat sup{font-size:10px;}
.trigger .tstat sup a{color:var(--heat-text);}
.trigger .ctx{font-size:13.5px;color:var(--ink-3);line-height:1.5;margin-bottom:14px;}
.trigger .impact{font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--heat-text);display:flex;align-items:center;gap:8px;}
.trigger .impact::before{content:'';width:16px;height:2px;background:var(--heat-text);flex-shrink:0;}

/* sticky buy bar */
.buybar{position:fixed;left:0;right:0;bottom:0;z-index:95;background:rgba(252,250,245,.96);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid var(--rule);transform:translateY(110%);transition:transform .4s cubic-bezier(.22,1,.36,1);padding-bottom:env(safe-area-inset-bottom);}
.buybar.show{transform:none;}
.buybar::before{content:'';position:absolute;top:-1px;left:0;right:0;height:2px;background:var(--seam);opacity:.85;}
.buybar-inner{max-width:var(--maxw);margin:0 auto;display:flex;align-items:center;gap:18px;padding:10px clamp(16px,5vw,32px);}
.bb-info{display:flex;flex-direction:column;gap:2px;min-width:0;overflow:hidden;}
.bb-tag{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-text);white-space:nowrap;}
.bb-name{font-family:var(--serif);font-size:18px;font-weight:500;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.bb-price{display:flex;flex-direction:column;gap:2px;margin-left:auto;text-align:right;}
.bb-amt{font-family:var(--mono);font-weight:600;font-size:22px;color:var(--ink);line-height:1;}
.bb-unit{font-size:13px;color:var(--ink-3);margin-left:1px;}
.bb-was{font-family:var(--mono);font-size:12px;color:var(--ink-4);text-decoration:line-through;margin-left:5px;}
.bb-sub{font-family:var(--mono);font-size:10px;letter-spacing:.03em;color:var(--ink-3);}
.bb-cta{flex-shrink:0;padding:13px 24px;}
@media(max-width:620px){
  .bb-info{display:none;}
  .buybar-inner{gap:12px;padding:9px 16px;}
  .bb-price{margin-left:0;text-align:left;flex:1;min-width:0;}
  .bb-amt{font-size:19px;}
  .bb-was{font-size:11px;margin-left:4px;}
  .bb-sub{display:block;}
  .bb-cta{margin-left:auto;padding:12px 22px;font-size:14px;}
}

/* checkout */
.checkout{padding:40px 0 80px;position:relative;z-index:1;}
/* focused checkout header — persistent exit, no marketing nav */
.co-header{position:sticky;top:0;z-index:100;background:var(--bone);border-bottom:1px solid var(--rule);}
.co-header::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--seam);}
.co-header-in{max-width:var(--maxw);margin:0 auto;padding:15px clamp(20px,5vw,32px);padding-top:max(15px,env(safe-area-inset-top));display:flex;align-items:center;justify-content:space-between;gap:16px;}
.co-home{display:inline-flex;align-items:center;gap:10px;color:var(--ink);}
.co-home:hover{color:var(--blue);}
.co-home .brand{font-size:24px;}
.co-secure-badge{display:inline-flex;align-items:center;gap:7px;font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--recovery-deep);white-space:nowrap;}
.co-back{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600;color:var(--ink-3);margin-bottom:22px;}
.co-back:hover{color:var(--blue);}
.co-h1{font-family:var(--serif);font-weight:400;font-size:clamp(30px,5vw,46px);letter-spacing:-.02em;line-height:1;margin-bottom:8px;}
.co-secure{display:inline-flex;align-items:center;gap:7px;font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--recovery-deep);margin-bottom:34px;}
.co-grid{display:grid;grid-template-columns:1.25fr .75fr;gap:48px;align-items:start;}
@media(max-width:900px){.co-grid{grid-template-columns:1fr;gap:0;}}
.co-step{margin-bottom:30px;}
.co-step .lbl{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);margin-bottom:16px;display:flex;align-items:center;gap:10px;}
.co-step .lbl .n{width:22px;height:22px;border-radius:50%;background:var(--blue);color:var(--bone);display:flex;align-items:center;justify-content:center;font-size:11px;font-family:var(--mono);}
.express{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
.exp-btn{display:flex;align-items:center;justify-content:center;height:52px;border:1px solid var(--rule);border-radius:12px;background:var(--paper);font-weight:600;font-size:14px;transition:border-color .2s,transform .1s;}
.exp-btn:hover{border-color:var(--blue);}.exp-btn:active{transform:scale(.98);}
.divider{display:flex;align-items:center;gap:14px;margin:24px 0 4px;color:var(--ink-4);font-size:10.5px;font-family:var(--mono);letter-spacing:.12em;text-transform:uppercase;}
.divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--rule);}
.field{margin-bottom:14px;}
.fields-2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
@media(max-width:520px){.fields-2{grid-template-columns:1fr;}}
.field label{display:block;font-size:13px;font-weight:600;color:var(--ink-2);margin-bottom:7px;}
.field input{width:100%;font-family:var(--sans);font-size:15px;color:var(--ink);background:var(--paper);border:1px solid var(--rule);border-radius:10px;padding:13px 14px;transition:border-color .2s,box-shadow .2s;}
.field input:focus{outline:0;border-color:var(--blue);box-shadow:0 0 0 4px rgba(6,8,169,.12);}
.field input::placeholder{color:var(--ink-4);}
.payopts{display:flex;flex-direction:column;gap:10px;}
.payopt{display:flex;align-items:center;gap:13px;border:1px solid var(--rule);border-radius:12px;padding:15px 16px;text-align:left;transition:border-color .2s,box-shadow .2s;background:var(--paper);width:100%;}
.payopt:hover{border-color:var(--gold-soft);}
.payopt.on{border-color:var(--blue);box-shadow:0 0 0 3px rgba(6,8,169,.1);}
.payopt .radio{width:18px;height:18px;border-radius:50%;border:2px solid var(--rule);flex-shrink:0;display:flex;align-items:center;justify-content:center;}
.payopt.on .radio{border-color:var(--blue);}
.payopt.on .radio::after{content:'';width:8px;height:8px;border-radius:50%;background:var(--blue);}
.payopt .pname{font-size:14.5px;font-weight:600;display:block;}
.payopt .pdesc{font-size:12px;color:var(--ink-3);margin-top:1px;display:block;}

/* order summary */
.summary{background:var(--paper);border:1px solid var(--rule);border-radius:16px;padding:26px 24px;position:sticky;top:92px;}
.sum-item{display:flex;gap:14px;padding-bottom:20px;border-bottom:1px solid var(--rule);margin-bottom:18px;}
.sum-thumb{width:62px;height:62px;border-radius:12px;flex-shrink:0;background:var(--bone);display:flex;align-items:center;justify-content:center;padding:7px;}
.si-name{font-family:var(--serif);font-size:17px;font-weight:500;}
.si-desc{font-size:12px;color:var(--ink-3);margin-top:3px;line-height:1.4;}
.si-price{margin-left:auto;font-family:var(--mono);font-weight:600;font-size:14px;white-space:nowrap;}
.qty{display:inline-flex;align-items:center;border:1px solid var(--rule);border-radius:100px;margin-top:10px;overflow:hidden;}
.qty button{width:32px;height:32px;font-size:17px;color:var(--ink-2);display:flex;align-items:center;justify-content:center;}
.qty button:hover{background:var(--bone);color:var(--blue);}
.qty .q{min-width:32px;text-align:center;font-family:var(--mono);font-size:14px;font-weight:600;}
.sum-row{display:flex;justify-content:space-between;font-size:14px;color:var(--ink-2);margin-bottom:11px;}
.sum-row .free{color:var(--recovery-deep);font-weight:600;}
.sum-total{display:flex;justify-content:space-between;align-items:baseline;padding-top:16px;border-top:1px solid var(--rule);margin-top:6px;}
.sum-total .t{font-family:var(--serif);font-size:18px;}
.sum-total .amt{font-family:var(--mono);font-weight:600;font-size:26px;color:var(--ink);}
.co-place{width:100%;justify-content:center;margin-top:20px;padding:17px;font-size:16px;}
.co-trust{margin-top:18px;display:flex;flex-direction:column;gap:9px;}
.co-trust .tr{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--ink-3);}
.co-trust .tr svg{color:var(--recovery-deep);flex-shrink:0;}

/* mobile summary toggle + sticky pay bar */
.co-msum{display:none;}
.co-paybar{display:none;}
@media(max-width:900px){
  .co-msum{display:flex;align-items:center;justify-content:space-between;width:100%;border:1px solid var(--rule);border-radius:12px;padding:14px 16px;background:var(--paper);margin-bottom:22px;}
  .co-msum .l{font-size:13.5px;font-weight:600;color:var(--blue);display:flex;align-items:center;gap:8px;}
  .co-msum .amt{font-family:var(--mono);font-weight:600;font-size:17px;}
  .summary{display:none;position:static;margin-top:8px;margin-bottom:24px;}
  .summary.open{display:block;}
  .summary .co-place,.summary .co-trust{display:none;}
  .co-paybar{display:flex;align-items:center;justify-content:space-between;gap:14px;position:fixed;left:0;right:0;bottom:0;z-index:96;background:var(--paper);border-top:1px solid var(--rule);box-shadow:0 -10px 30px rgba(20,16,25,.1);padding:11px clamp(16px,5vw,24px);padding-bottom:max(11px,env(safe-area-inset-bottom));}
  .co-paybar::before{content:'';position:absolute;top:-1px;left:0;right:0;height:2px;background:var(--seam);opacity:.85;}
  .cp-amt{font-family:var(--mono);font-weight:600;font-size:19px;}
  .cp-sub{font-size:11px;color:var(--ink-3);}
  .co-paybar .btn-primary{padding:14px 26px;}
  .checkout{padding-bottom:96px;}
}

/* checkout success */
.co-success{max-width:560px;}
.co-success .ok{width:64px;height:64px;border-radius:50%;background:var(--recovery-soft);color:var(--recovery-deep);display:flex;align-items:center;justify-content:center;margin-bottom:22px;}
.co-suc-sub{font-size:16px;color:var(--ink-2);line-height:1.6;margin-bottom:32px;max-width:46ch;}
.co-suc-sub b{font-family:var(--mono);font-weight:600;}
.co-next{display:flex;flex-direction:column;gap:0;border-top:1px solid var(--rule);margin-bottom:32px;}
.co-nx{display:flex;gap:16px;padding:20px 0;border-bottom:1px solid var(--rule);align-items:flex-start;}
.co-nx-n{font-family:var(--mono);font-size:12px;font-weight:600;color:var(--blue);margin-top:2px;}
.co-nx-h{font-family:var(--serif);font-size:18px;font-weight:500;margin-bottom:3px;}
.co-nx-p{font-size:14px;color:var(--ink-3);line-height:1.5;}

/* checkout add-ons */
.co-step .lbl .opt{color:var(--ink-4);font-weight:500;letter-spacing:.08em;}
.addons{display:flex;flex-direction:column;gap:10px;}
.addon{display:flex;align-items:center;gap:14px;border:1px solid var(--rule);border-radius:12px;padding:13px 14px;background:var(--paper);transition:border-color .2s,box-shadow .2s;}
.addon.on{border-color:var(--blue);box-shadow:0 0 0 3px rgba(6,8,169,.08);}
.ad-thumb{width:46px;height:46px;border-radius:10px;flex-shrink:0;background:radial-gradient(120% 80% at 30% 20%,#F7E6CC,transparent 55%),linear-gradient(158deg,#C68A5E,#9E6A48);}
.ad-tx{min-width:0;}
.ad-nm{font-size:14.5px;font-weight:600;}
.ad-ds{font-size:12px;color:var(--ink-3);margin-top:1px;}
.ad-pr{margin-left:auto;font-family:var(--mono);font-weight:600;font-size:14px;white-space:nowrap;}
.ad-btn{flex-shrink:0;border:1px solid var(--rule);border-radius:100px;padding:8px 16px;font-size:13px;font-weight:600;color:var(--blue);transition:background .2s,color .2s,border-color .2s;min-height:36px;}
.ad-btn:hover{background:var(--bone);}
.ad-btn.on{background:var(--blue);color:var(--bone);border-color:var(--blue);}
@media(max-width:520px){.ad-thumb{display:none;}.ad-pr{font-size:13px;}.ad-btn{padding:8px 14px;}}
.sum-addon{display:flex;justify-content:space-between;align-items:center;font-size:13.5px;color:var(--ink-2);margin-bottom:11px;gap:10px;}
.sum-addon .sa-pr{font-family:var(--mono);display:inline-flex;align-items:center;gap:8px;color:var(--ink-3);}
.sum-addon .sa-pr button{width:18px;height:18px;border-radius:50%;border:1px solid var(--rule);color:var(--ink-3);font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.sum-addon .sa-pr button:hover{border-color:var(--heat-text);color:var(--heat-text);}

/* reveal */
.reveal{opacity:0;transform:translateY(18px);transition:opacity .85s var(--ease),transform .85s var(--ease);}
.reveal.in{opacity:1;transform:none;}
/* cart */
.nav-cart{position:relative;display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;color:var(--ink);transition:background .2s,color .2s;}
.nav-cart:hover{background:var(--bone);color:var(--blue);}
.cart-badge{position:absolute;top:1px;right:-1px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--blue);color:#fff;font-family:var(--mono);font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;line-height:1;}
.cart-scrim{position:fixed;inset:0;background:rgba(20,16,25,.42);opacity:0;visibility:hidden;transition:opacity .3s;z-index:200;}
.cart-scrim.on{opacity:1;visibility:visible;}
.cart-drawer{position:fixed;top:0;right:0;bottom:0;width:min(420px,92vw);background:var(--paper);z-index:201;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .34s cubic-bezier(.4,0,.2,1);box-shadow:-24px 0 60px -30px rgba(0,0,0,.5);}
.cart-drawer.open{transform:none;}
.cart-head{display:flex;align-items:center;justify-content:space-between;padding:20px 22px;border-bottom:1px solid var(--rule);}
.ch-t{font-family:var(--serif);font-size:20px;display:flex;align-items:center;gap:10px;}
.ch-n{font-family:var(--mono);font-size:12px;font-weight:600;color:#fff;background:var(--blue);border-radius:999px;padding:2px 8px;}
.cart-x{width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:8px;color:var(--ink-2);}
.cart-x:hover{background:var(--bone);color:var(--ink);}
.cart-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:var(--ink-3);padding:40px;text-align:center;}
.cart-empty svg{color:var(--ink-4);}
.cart-items{flex:1;overflow-y:auto;padding:8px 22px;}
.cart-line{display:flex;gap:14px;padding:18px 0;border-bottom:1px solid var(--rule);}
.cl-thumb{flex:none;width:56px;height:56px;border-radius:10px;background:var(--bone);display:flex;align-items:center;justify-content:center;padding:6px;}
.cl-main{flex:1;min-width:0;}
.cl-name{font-weight:600;font-size:14px;color:var(--ink);}
.cl-desc{font-size:12px;color:var(--ink-3);margin:2px 0 8px;}
.cl-right{display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;gap:8px;}
.cl-price{font-family:var(--mono);font-size:14px;font-weight:600;color:var(--ink);}
.cl-rm{font-size:11px;color:var(--ink-4);text-decoration:underline;}
.cl-rm:hover{color:var(--heat-text);}
.cart-foot{border-top:1px solid var(--rule);padding:20px 22px;padding-bottom:max(20px,env(safe-area-inset-bottom));}
.cart-sub{display:flex;justify-content:space-between;font-size:15px;font-weight:600;margin-bottom:14px;}
.cart-co{width:100%;justify-content:center;}
.cart-note{display:flex;align-items:center;gap:7px;justify-content:center;font-family:var(--mono);font-size:10.5px;color:var(--ink-4);margin-top:12px;}
.sum-empty{font-size:13px;color:var(--ink-3);padding:8px 0 16px;}
.sum-empty a{color:var(--blue);font-weight:600;}
@media(max-width:860px){.nav-cart{margin-left:auto;width:34px;height:34px;}}

@media(prefers-reduced-motion:reduce){
  .gg *{animation:none!important;transition:none!important;}
  .reveal{opacity:1;transform:none;}
  .bs-fill{width:var(--w)!important;}
  .traj-svg polyline{stroke-dashoffset:0!important;}
  .sheet{transition:none!important;}
}

/* ───── Sept 2026 build: 5-Night Watch, dose, pricing, footer offer, About (Addenda 01–03) ───── */
.bs-beta{display:inline-flex;align-items:center;gap:5px;font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;padding:2px 8px;border-radius:100px;border:1px dashed var(--gold-text);color:var(--gold-text);white-space:nowrap;}
.bs-sample{display:block;margin-top:14px;padding-top:10px;border-top:1px solid var(--rule);font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-4);}
.soh-felt{margin:28px 0 0;display:flex;flex-direction:column;}
.soh-fr{display:flex;gap:18px;padding:16px 0;border-top:1px solid var(--rule);}
.soh-fr:first-child{border-top:none;padding-top:0;}
.soh-wk{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--recovery-deep);min-width:64px;padding-top:4px;}
.soh-ft{font-family:var(--serif);font-size:clamp(18px,2.4vw,22px);line-height:1.3;color:var(--ink);}
.soh-fs{font-family:var(--mono);font-size:12px;color:var(--ink-3);margin-top:4px;}

.trialband{position:relative;z-index:1;background:var(--slate);color:var(--bone);border-radius:22px;padding:clamp(22px,4vw,36px);display:grid;grid-template-columns:1fr auto;gap:18px 32px;align-items:center;overflow:hidden;}
.trialband::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 90% 0%,rgba(176,141,91,.28),transparent 55%);pointer-events:none;}
.trialband > *{position:relative;}
.tb-eyebrow{font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--gold-soft);}
.tb-h{font-family:var(--serif);font-weight:400;font-size:clamp(24px,3.4vw,36px);line-height:1.1;margin:8px 0 8px;max-width:22ch;}
.tb-h em{font-style:italic;color:var(--gold-soft);}
.tb-line{font-size:15.5px;color:rgba(244,241,234,.82);max-width:52ch;}
.tb-small{font-size:13.5px;color:rgba(244,241,234,.66);margin-top:10px;}
.cry-in{font-family:var(--serif);color:var(--gold-text);}
.tb-sign{font-family:var(--serif);font-style:italic;font-size:19px;color:#E7D3A8;margin-top:12px;}
.tb-creed{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px;}
.tb-creed span{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#E7D3A8;border:1px solid rgba(201,172,126,.55);border-radius:100px;padding:5px 11px;}
.tb-side{display:flex;flex-direction:column;align-items:flex-end;gap:10px;}
.tb-price{font-family:var(--serif);font-size:clamp(40px,6vw,60px);line-height:1;}
.tb-price small{display:block;font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--gold-soft);text-align:right;margin-top:6px;}
.gg .tb-btn{display:inline-flex;align-items:center;gap:12px;padding:15px 26px;border-radius:100px;background:var(--bone);color:var(--blue);font-size:15px;font-weight:700;white-space:nowrap;justify-content:center;}
.tb-btn:hover{transform:translateY(-2px);}
.tb-member{font-size:13px;color:rgba(244,241,234,.75);}
@media(max-width:760px){.trialband{grid-template-columns:1fr;}.tb-side{align-items:stretch;}.tb-price small{text-align:left;}.gg .tb-btn{width:100%;}}

.dose-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:30px;}
.dose-card{border:1px solid var(--rule);border-radius:16px;padding:24px 22px;background:var(--paper);}
.dose-card .dc-goal{font-family:var(--serif);font-size:26px;line-height:1.1;color:var(--ink);}
.dose-card .dc-day{font-family:var(--mono);font-size:13px;color:var(--blue);margin:6px 0 16px;font-weight:600;}
.dc-row{display:flex;justify-content:space-between;font-size:14.5px;padding:9px 0;border-top:1px solid var(--rule-soft);color:var(--ink-2);}
.dc-row b{color:var(--ink);font-weight:600;}
.dc-meta{font-family:var(--mono);font-size:11px;color:var(--ink-4);margin-top:12px;letter-spacing:.03em;}
.dose-note{font-size:14.5px;color:var(--ink-3);margin-top:18px;max-width:70ch;}
@media(max-width:760px){.dose-cards{grid-template-columns:1fr;}}

.timeline{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:26px;}
.tl-item{border-left:2px solid var(--recovery);padding:4px 0 4px 16px;}
.tl-day{font-family:var(--mono);font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--recovery-deep);}
.tl-txt{font-size:15px;color:var(--ink-2);margin-top:4px;}
@media(max-width:760px){.timeline{grid-template-columns:1fr;}}

.phase-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:28px;}
.phase-card{border:1px solid var(--rule);border-radius:16px;padding:22px;background:var(--paper);}
.phase-card .pc-n{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-text);}
.phase-card h3{font-family:var(--serif);font-weight:500;font-size:26px;margin:6px 0 6px;}
.phase-card .pc-wk{font-size:14.5px;font-weight:600;color:var(--blue);margin-bottom:8px;}
.phase-card p{font-size:14.5px;color:var(--ink-3);line-height:1.5;}
@media(max-width:760px){.phase-cards{grid-template-columns:1fr;}}

.goal-pick{display:inline-flex;gap:6px;padding:5px;border:1px solid var(--rule);border-radius:100px;background:var(--paper);flex-wrap:wrap;}
.goal-pick button{padding:11px 18px;border-radius:100px;font-size:14.5px;font-weight:600;color:var(--ink-2);min-height:44px;}
.goal-pick button[aria-pressed="true"]{background:var(--ink);color:var(--bone);}
@media(max-width:520px){.goal-pick{gap:3px;padding:4px;}.goal-pick button{padding:10px 11px;font-size:13px;}}
.goal-caps{font-family:var(--mono);font-size:12.5px;color:var(--ink-3);margin-top:10px;}
.price-cards{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:26px;}
.pcard{position:relative;border:1px solid var(--rule);border-radius:18px;padding:30px 26px 26px;background:var(--paper);display:flex;flex-direction:column;}
.pcard.sel{border:2px solid var(--blue);box-shadow:0 26px 64px -42px rgba(6,8,169,.45);}
.pcard .pc-tag{position:absolute;top:-11px;left:24px;font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;background:var(--ink);color:var(--paper);padding:4px 10px;border-radius:100px;}
.pcard.sel .pc-tag{background:var(--blue);}
.pcard .pc-name{font-family:var(--serif);font-size:24px;color:var(--ink);}
.pcard .pc-big{font-family:var(--serif);font-size:clamp(38px,5vw,52px);font-weight:600;line-height:1;margin:14px 0 8px;color:var(--ink);}
.pcard .pc-big span{font-family:var(--mono);font-size:14px;font-weight:400;color:var(--ink-3);}
.pcard .pc-line{font-family:var(--mono);font-size:13px;color:var(--ink-3);margin-bottom:22px;}
.pcard .btn-primary{margin-top:auto;justify-content:center;width:100%;}
.pcard .pc-alt{margin-top:auto;display:inline-flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:16px 24px;border-radius:100px;border:1.5px solid var(--ink);font-size:15px;font-weight:600;color:var(--ink);}
.pcard .pc-alt:hover{border-color:var(--blue);color:var(--blue);}
@media(max-width:760px){.price-cards{grid-template-columns:1fr;}}
.more{margin-top:18px;border-top:1px solid var(--rule);}
.more details{border-bottom:1px solid var(--rule);}
.more summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:18px 2px;font-weight:600;font-size:16px;min-height:44px;}
.more summary::-webkit-details-marker{display:none;}
.more details[open] summary svg{transform:rotate(180deg);}
.more .mb{padding:0 2px 20px;}
.mini-table{width:100%;border-collapse:collapse;font-size:14.5px;}
.mini-table th,.mini-table td{text-align:left;padding:10px 8px;border-top:1px solid var(--rule-soft);}
.mini-table th{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);font-weight:600;border-top:0;}
.opt-row{display:flex;align-items:center;gap:14px;padding:14px 0;border-top:1px solid var(--rule-soft);}
.opt-row:first-child{border-top:0;}
.opt-row .on{flex:1;min-width:0;}
.opt-row b{display:block;font-size:15.5px;}
.opt-row span{font-family:var(--mono);font-size:12.5px;color:var(--ink-3);}
.gg .opt-buy{flex:none;padding:10px 18px;border-radius:100px;border:1px solid var(--rule);font-size:14px;font-weight:600;color:var(--blue);min-height:44px;display:inline-flex;align-items:center;}
.opt-buy:hover{border-color:var(--blue);}
.fine{font-size:13.5px;color:var(--ink-3);margin-top:14px;max-width:70ch;}

.about-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:26px;}
.about-card{border:1px solid var(--rule);border-radius:16px;padding:24px;background:var(--paper);}
.about-card h3{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-text);font-weight:600;margin-bottom:8px;}
.about-card p{font-size:15.5px;color:var(--ink-2);line-height:1.55;}
.about-list{list-style:none;display:flex;flex-direction:column;gap:12px;margin-top:22px;max-width:70ch;}
.about-list li{display:flex;gap:11px;font-size:15.5px;color:var(--ink-2);align-items:flex-start;}
.about-list li svg{color:var(--recovery-deep);flex:none;margin-top:4px;}
.person{padding:18px 0;border-top:1px solid var(--rule);max-width:74ch;}
.person b{font-family:var(--serif);font-size:21px;font-weight:500;display:block;color:var(--ink);}
.person span{font-size:15px;color:var(--ink-3);line-height:1.55;}
@media(max-width:760px){.about-grid{grid-template-columns:1fr;}}
.mission{font-family:var(--serif);font-style:italic;font-size:clamp(24px,3.4vw,36px);line-height:1.2;color:var(--blue);max-width:28ch;}

.buybar .bb-skip{font-size:13px;font-weight:600;color:var(--blue);text-decoration:underline;text-underline-offset:3px;white-space:nowrap;}
@media(max-width:900px){.buybar .bb-skip{display:none;}}
.demo-chip{position:fixed;left:10px;bottom:88px;z-index:96;background:var(--ink);color:var(--bone);border-radius:14px;padding:8px 10px;font-family:var(--mono);font-size:10.5px;letter-spacing:.04em;box-shadow:0 10px 30px rgba(0,0,0,.25);display:flex;align-items:center;gap:8px;}
.demo-chip select{font-family:var(--mono);font-size:11px;border-radius:8px;padding:4px 6px;background:var(--bone);color:var(--ink);border:0;}
.nav-lifestyle{font-size:14px;font-weight:600;color:var(--ink-3);padding:6px 0;}
.nav-lifestyle:hover{color:var(--blue);}
.daily-row{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-top:18px;padding:20px 22px;border:1px solid var(--rule);border-radius:16px;background:var(--paper);}
.dr-txt{flex:1;min-width:240px;display:flex;flex-direction:column;gap:3px;}
.dr-tag{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-text);}
.dr-txt b{font-family:var(--serif);font-size:24px;font-weight:600;color:var(--ink);}
.dr-txt span:last-child{font-size:13.5px;color:var(--ink-3);}
@media(max-width:620px){.daily-row .btn-primary{width:100%;justify-content:center;}}
.trial-first{border-color:var(--blue);background:var(--paper);}
.trial-nm small{display:block;font-family:var(--mono);font-size:10.5px;color:var(--ink-3);}
.legal-list{list-style:none;margin-top:24px;max-width:70ch;}
.legal-list li{padding:18px 0;border-top:1px solid var(--rule);}
.legal-list b{font-family:var(--serif);font-size:21px;font-weight:500;display:block;}
.legal-list span{font-size:15px;color:var(--ink-3);}
.sl{max-width:460px;margin:0 auto;min-height:100vh;padding:12px 18px 92px;display:flex;flex-direction:column;}
.sl-top{display:flex;align-items:center;justify-content:space-between;}
.sl-brand{display:flex;align-items:center;gap:8px;font-family:var(--serif);font-size:20px;font-weight:500;letter-spacing:-.01em;color:var(--ink);}
.sl-brand .dot{width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,var(--heat-text),var(--recovery-deep));}
.sl-cart{position:relative;width:42px;height:42px;border-radius:50%;border:1px solid var(--rule);background:var(--paper);color:var(--ink);display:flex;align-items:center;justify-content:center;}
.sl-cart .n{position:absolute;top:-5px;right:-5px;min-width:19px;height:19px;padding:0 5px;border-radius:10px;background:var(--blue);color:#fff;font-family:var(--mono);font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;border:2px solid var(--bone);}
.sl-prow{display:flex;align-items:center;gap:14px;margin:10px 0 14px;}
.sl-prow .nm{font-family:var(--serif);font-size:25px;font-weight:500;letter-spacing:-.02em;color:var(--ink);line-height:1;}
.sl-prow .tg{font-size:12.5px;color:var(--ink-3);line-height:1.45;margin-top:4px;}
.sl-toggle{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:var(--bone);border:1px solid var(--rule);border-radius:13px;padding:4px;margin-bottom:16px;}
.sl-toggle button{padding:11px 8px;border-radius:9px;font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3);transition:color .15s,background .15s;}
.sl-toggle button.on{background:var(--paper);color:var(--ink);box-shadow:0 2px 7px rgba(20,16,25,.09);}
.sl-lab{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-text);margin-bottom:11px;display:flex;align-items:center;justify-content:space-between;}
.sl-lab .save{color:var(--recovery-deep);}
.sv{color:var(--recovery-deep);font-weight:600;}
.sl-chip .cpc.svp{display:inline-block;background:var(--recovery-deep);color:#FCFAF5;border-radius:100px;padding:2px 8px;margin:3px auto 1px;}
.co-swap{margin:0 0 14px;padding:12px 14px;border-radius:12px;background:#EEF4FA;border:1px solid #BCD3EA;font-size:13px;line-height:1.5;color:var(--ink-2);}
.co-swap b{color:var(--ink);display:block;margin-bottom:2px;}
.co-swap button{margin-top:8px;font-weight:600;color:var(--blue,#0608A9);text-decoration:underline;text-underline-offset:3px;}
.sl-topts{display:grid;grid-template-columns:1fr 1fr;gap:9px;}
.sl-topt{border:1.5px solid var(--rule);background:var(--paper);border-radius:14px;padding:14px;text-align:left;transition:border-color .15s;}
.sl-topt.on{border-color:var(--ink);}
.sl-topt .tn{font-family:var(--serif);font-size:17px;font-weight:500;color:var(--ink);}
.sl-topt .tc{font-family:var(--mono);font-size:11px;color:var(--ink-3);margin-top:1px;}
.sl-topt .tp{font-family:var(--serif);font-size:19px;font-weight:600;color:var(--ink);margin-top:8px;}
.sl-note{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--ink-3);margin-top:12px;}
.sl-note svg{flex:none;color:var(--recovery-deep);}
.sl-chips{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
.sl-chip{position:relative;border:1.5px solid var(--rule);background:var(--paper);border-radius:14px;padding:13px 5px 11px;text-align:center;transition:border-color .16s,box-shadow .16s,background .16s;}
.sl-chip.on{border-color:var(--blue);background:linear-gradient(180deg,rgba(6,8,169,.045),rgba(6,8,169,0));box-shadow:0 18px 40px -32px rgba(6,8,169,.6);}
.sl-chip .cn{font-family:var(--serif);font-size:18px;font-weight:500;color:var(--ink);display:block;}
.sl-chip .cpc{font-family:var(--mono);font-size:11px;color:var(--recovery-deep);font-weight:600;margin-top:2px;display:block;}
.sl-chip .cd{font-family:var(--mono);font-size:11px;color:var(--ink-3);display:block;}
.sl-chip .ctag{position:absolute;top:-8px;left:50%;transform:translateX(-50%);white-space:nowrap;font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;background:var(--ink);color:var(--paper);padding:3px 8px;border-radius:999px;}
.sl-chip.on .ctag{background:var(--blue);}
.sl-chip .cmk{position:absolute;top:6px;right:6px;color:var(--blue);}
.sl-stats{display:grid;grid-template-columns:1fr 1fr 1fr;margin-top:13px;border:1px solid var(--rule);border-radius:14px;background:var(--paper);overflow:hidden;}
.sl-stat{padding:13px 6px;text-align:center;border-left:1px solid var(--rule);}
.sl-stat:first-child{border-left:none;}
.sl-stat.hl{background:linear-gradient(180deg,rgba(30,111,184,.06),transparent);}
.sl-stat b{font-family:var(--serif);font-size:23px;font-weight:600;color:var(--ink);display:block;letter-spacing:-.015em;line-height:1;animation:slpop .35s var(--ease);}
.sl-stat span{font-family:var(--mono);font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3);margin-top:5px;display:block;}
.sl-trustline{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:16px;flex-wrap:wrap;}
.sl-trustline .t{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--ink-3);}
.sl-trustline .t svg{color:var(--recovery-deep);}
.sl-detbtn{display:flex;align-items:center;justify-content:center;gap:6px;margin:14px auto 0;font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);}
.sl-detrow{display:flex;gap:20px;justify-content:center;margin-top:14px;}
.sl-detrow .sl-detbtn{margin:0;}
.fx{border:1.5px solid var(--ink);border-radius:12px;padding:14px 16px;margin-top:18px;background:var(--paper);}
.fx-h{font-family:var(--serif);font-size:19px;font-weight:600;color:var(--ink);border-bottom:2px solid var(--ink);padding-bottom:8px;margin-bottom:9px;}
.fx-serv{display:flex;flex-direction:column;gap:2px;font-size:12.5px;color:var(--ink-2);}
.fx-serv b{font-family:var(--mono);font-weight:600;}
.fx-serv .fx-use{font-size:11px;color:var(--ink-3);}
.fx-rule{height:1.5px;background:var(--ink);margin:9px 0;opacity:.85;}
.fx-col{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);margin-bottom:5px;}
.fx-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:6px 0;border-bottom:1px dotted var(--rule);font-size:13px;color:var(--ink);}
.fx-row:last-of-type{border-bottom:none;}
.fx-row b{font-family:var(--mono);font-size:12.5px;font-weight:600;white-space:nowrap;}
.fx-row b.tbd{color:var(--ink-3);font-weight:400;font-style:italic;}
.fx-note{font-size:11.5px;color:var(--ink-3);line-height:1.5;margin-top:7px;}
.fx-note b{color:var(--ink-2);font-weight:600;}
.fx-draft{font-family:var(--mono);font-size:11px;letter-spacing:.02em;color:var(--heat-text);background:rgba(181,67,31,.07);border:1px solid rgba(181,67,31,.22);border-radius:8px;padding:9px 11px;margin-top:12px;line-height:1.45;}
.fx-row sup{font-size:11px;color:var(--ink-3);}
.fx-macros{font-family:var(--mono);font-size:11px;color:var(--ink-3);line-height:1.55;}
.fx-foot{font-size:11px;color:var(--ink-3);line-height:1.45;margin-top:10px;font-style:italic;}
.sl-detbtn:hover{color:var(--ink);}
.sl-spacer{flex:1;}
.sl-bar{position:fixed;left:0;right:0;bottom:0;z-index:45;max-width:460px;margin:0 auto;background:rgba(252,250,245,.92);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-top:1px solid var(--rule);padding:11px 18px calc(11px + env(safe-area-inset-bottom));box-shadow:0 -10px 34px -22px rgba(20,16,25,.45);}
.sl-bar .btn-primary{width:100%;justify-content:center;font-size:16px;height:54px;}
.sl-bar .btn-primary .p{opacity:.72;font-weight:500;margin-left:3px;}
/* sheets */
.sl-scrim{position:fixed;inset:0;background:rgba(20,16,25,.42);opacity:0;pointer-events:none;transition:opacity .22s;z-index:118;}
.sl-scrim.on{opacity:1;pointer-events:auto;}
.sl-sheet{position:fixed;left:0;right:0;bottom:0;z-index:120;background:var(--paper);border-radius:24px 24px 0 0;padding:8px 20px calc(22px + env(safe-area-inset-bottom));max-width:460px;margin:0 auto;transform:translateY(103%);transition:transform .32s var(--ease);max-height:90vh;overflow-y:auto;}
.sl-sheet.on{transform:translateY(0);}
.sl-grip{width:38px;height:4px;border-radius:2px;background:var(--rule);margin:0 auto 14px;}
.sl-sh-h{font-family:var(--serif);font-size:22px;font-weight:500;margin-bottom:12px;display:flex;align-items:center;gap:10px;justify-content:space-between;color:var(--ink);}
.sl-sh-h .bk{color:var(--ink-3);display:flex;align-items:center;gap:8px;}
.sl-sh-h button{color:var(--ink-3);}
.sl-line{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid var(--rule);}
.sl-line .lc{flex:none;width:40px;height:40px;border-radius:9px;background:var(--bone);display:flex;align-items:center;justify-content:center;}
.sl-line .lc i{width:14px;height:21px;border-radius:100px;background:linear-gradient(180deg,var(--heat-text) 50%,var(--recovery-deep) 50%);display:block;}
.sl-line .ln{font-size:13.5px;font-weight:600;color:var(--ink);}
.sl-line .ld{font-family:var(--mono);font-size:11px;color:var(--ink-3);}
.sl-mq{display:inline-flex;align-items:center;border:1px solid var(--rule);border-radius:9px;margin-left:auto;}
.sl-mq button{width:27px;height:27px;background:var(--bone);font-size:15px;color:var(--ink);}
.sl-mq .q{min-width:22px;text-align:center;font-family:var(--mono);font-size:12px;}
.sl-lp{margin-left:11px;font-family:var(--mono);font-size:12.5px;color:var(--ink);white-space:nowrap;}
.sl-tot{display:flex;justify-content:space-between;align-items:baseline;margin:14px 0 12px;padding-top:13px;border-top:1px solid var(--rule);}
.sl-tot .amt{font-family:var(--serif);font-size:26px;font-weight:600;color:var(--ink);}
.sl-sheet .btn-primary{width:100%;justify-content:center;}
.sl-empty{text-align:center;color:var(--ink-3);font-size:14px;padding:26px 0;}
/* checkout form */
.co-sum{display:flex;justify-content:space-between;align-items:center;background:var(--bone);border:1px solid var(--rule);border-radius:12px;padding:11px 14px;margin-bottom:16px;font-size:13px;}
.co-sum b{font-family:var(--serif);font-size:17px;font-weight:600;}
.co-grp{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);margin:14px 0 10px;}
.co-f{margin-bottom:10px;}
.co-f label{display:block;font-size:12px;color:var(--ink-3);margin-bottom:5px;}
.co-f input{width:100%;padding:11px 13px;border:1px solid var(--rule);border-radius:10px;font-size:15px;font-family:inherit;background:var(--paper);color:var(--ink);}
.co-f input:focus{outline:none;border-color:var(--blue);box-shadow:0 0 0 3px rgba(6,8,169,.08);}
.co-f.err input{border-color:var(--heat-text);}
.co-f .fe{display:block;font-size:11px;color:var(--heat-text);margin-top:4px;font-family:var(--mono);}
.co-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.co-pays{display:grid;grid-template-columns:1fr 1fr;gap:9px;}
.co-pay{display:flex;align-items:center;gap:9px;padding:12px;border:1.5px solid var(--rule);border-radius:11px;background:var(--paper);font-size:13.5px;color:var(--ink);transition:border-color .15s;}
.co-pay.on{border-color:var(--blue);box-shadow:0 0 0 1px var(--blue);}
.co-pay .rd{width:16px;height:16px;border-radius:50%;border:2px solid var(--rule);flex:none;}
.co-pay.on .rd{border-color:var(--blue);background:radial-gradient(circle,var(--blue) 42%,transparent 46%);}
.co-cardnote{display:flex;gap:7px;align-items:flex-start;font-size:11px;color:var(--ink-3);margin-top:8px;line-height:1.45;}
.co-cardnote svg{flex:none;margin-top:1px;}
.co-err{background:rgba(181,67,31,.08);border:1px solid rgba(181,67,31,.3);color:var(--heat-text);border-radius:10px;padding:10px 13px;font-size:12.5px;margin:12px 0;}
.co-guar{display:flex;gap:8px;align-items:flex-start;font-size:11.5px;color:var(--ink-3);margin-top:12px;line-height:1.45;}
.co-express{margin-bottom:2px;}
.co-exlabel{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);margin-bottom:9px;text-align:center;}
.co-exrow{display:grid;grid-template-columns:1fr 1fr;gap:9px;}
.co-ex{display:flex;align-items:center;justify-content:center;gap:6px;height:52px;border-radius:12px;background:var(--ink);color:var(--paper);font-size:13.5px;font-weight:600;transition:opacity .15s;}
.co-ex:active{opacity:.85;}
.co-ex b{font-weight:700;}
.co-ex:disabled{opacity:.5;}
.co-or{display:flex;align-items:center;gap:12px;margin:15px 0;color:var(--ink-3);font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;}
.co-or::before,.co-or::after{content:"";flex:1;height:1px;background:var(--rule);}
.co-install{margin-top:12px;border:1px solid var(--rule);border-radius:12px;padding:13px;background:var(--bone);}
.co-months{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
.co-mo{padding:11px 6px;border:1.5px solid var(--rule);border-radius:10px;background:var(--paper);font-family:var(--mono);font-size:12px;color:var(--ink);transition:border-color .15s,box-shadow .15s;}
.co-mo.on{border-color:var(--blue);box-shadow:0 0 0 1px var(--blue);}
.co-morow{display:flex;justify-content:space-between;align-items:baseline;margin-top:12px;padding-top:11px;border-top:1px solid var(--rule);}
.co-morow span{font-size:12.5px;color:var(--ink-3);}
.co-morow b{font-family:var(--serif);font-size:22px;font-weight:600;color:var(--ink);}
.co-monote{font-size:11px;color:var(--ink-3);margin-top:9px;line-height:1.45;font-style:italic;}
.co-trust{display:flex;justify-content:center;gap:16px;flex-wrap:wrap;margin-top:14px;}
.co-trust span{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--ink-3);}
.co-trust svg{color:var(--recovery-deep);flex:none;}
.co-guar svg{flex:none;color:var(--recovery-deep);margin-top:1px;}
/* success */
.co-ok{text-align:center;padding:8px 0 4px;}
.co-ok .ic{width:60px;height:60px;border-radius:50%;background:var(--recovery-deep);color:#fff;display:flex;align-items:center;justify-content:center;margin:6px auto 16px;}
.co-ok h3{font-family:var(--serif);font-size:25px;font-weight:500;color:var(--ink);}
.co-ok p{font-size:13.5px;color:var(--ink-2);margin:8px 0 20px;line-height:1.5;}
.co-next{text-align:left;margin-bottom:20px;}
.sl-dets .sl-proof-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;border:1px solid var(--rule);border-radius:14px;overflow:hidden;background:var(--paper);margin-bottom:6px;}
.sl-dets .pf{padding:13px 5px;text-align:center;border-left:1px solid var(--rule);}
.sl-dets .pf:first-child{border-left:none;}
.sl-dets .pf b{font-family:var(--serif);font-size:16px;font-weight:600;color:var(--ink);display:block;line-height:1;}
.sl-dets .pf span{font-family:var(--mono);font-size:11px;letter-spacing:.03em;text-transform:uppercase;color:var(--ink-3);margin-top:5px;display:block;line-height:1.3;}
.sl-toast{position:fixed;left:50%;bottom:94px;transform:translateX(-50%) translateY(14px);background:var(--ink);color:var(--paper);font-size:13px;font-weight:500;padding:11px 19px;border-radius:100px;box-shadow:0 10px 30px rgba(0,0,0,.26);opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:130;display:flex;align-items:center;gap:8px;white-space:nowrap;}
.sl-toast.on{opacity:1;transform:translateX(-50%) translateY(0);}
.sl-toast .ok{color:var(--recovery-deep);}
/* shoplet inside the website */
.sl.sl-page{padding-top:calc(78px + env(safe-area-inset-top));}
.sl-top .sl-prow{margin:0;flex:1;min-width:0;}
.sl-page>.sl-top{align-items:flex-start;gap:10px;margin:10px 0 14px;}
.sl-toggle.x3{grid-template-columns:1fr 1fr 1fr;}
@media (max-width:400px){.sl-toggle button{font-size:10px;letter-spacing:.02em;padding:10px 3px;white-space:nowrap;}.sl-topt .tfree{font-size:10px;letter-spacing:.02em;white-space:nowrap;}}
.sl-wide-opt{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px;}
.sl-wide-opt .tp{margin-top:0;}
.sl-wide-opt .wr{text-align:right;}
.sl-topt .tfree{display:block;margin-top:3px;font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--recovery-deep);}
.sl-chip .cn.sm{font-size:15px;line-height:1.15;}
.sl-eta{font-size:12px;color:var(--recovery-deep);font-weight:600;margin-top:6px;line-height:1.45;}
.sl-trust2{display:flex;justify-content:center;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--ink-3);margin-top:10px;}
.sl-trust2 span{display:inline-flex;align-items:center;gap:5px;}.sl-trust2 svg{color:var(--recovery-deep);}
.sl-trust2 a{color:var(--blue);font-weight:600;text-decoration:underline;text-underline-offset:2px;}
.sl-free{display:block;text-align:center;margin-top:10px;font-size:12.5px;color:var(--blue);font-weight:600;text-decoration:underline;text-underline-offset:3px;}
.sl-conote{font-size:12px;color:var(--ink-3);text-align:center;line-height:1.45;margin-top:10px;}
.sl-ship{display:flex;justify-content:space-between;font-size:13.5px;color:var(--ink-2);margin-top:12px;padding-top:12px;border-top:1px solid var(--rule);}
.sl-ship+.sl-tot{margin-top:8px;padding-top:8px;border-top:none;}
.sl-rm{margin-left:auto;font-family:var(--mono);font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-3);text-decoration:underline;text-underline-offset:3px;}
.sl-conflict{border:1.5px solid var(--heat-text);background:rgba(181,67,31,.06);border-radius:14px;padding:13px 14px;margin-bottom:12px;font-size:13px;color:var(--ink-2);line-height:1.45;}
.sl-conflict b{display:block;color:var(--ink);font-size:14px;margin-bottom:2px;}
.sl-conflict .cf-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;}
.sl-conflict .cf-btns button{padding:11px 8px;border-radius:10px;border:1.5px solid var(--ink);background:var(--paper);font-weight:600;font-size:13px;color:var(--ink);text-align:center;}
.sl-conflict .cf-btns button:first-child{background:var(--ink);color:var(--paper);}
/* desktop: product and "What's inside" on the left; buy box and buy button together on the right */
.sl.sl-wide{max-width:1120px;display:grid;grid-template-columns:minmax(0,1fr) 440px;gap:56px;align-items:start;min-height:auto;padding:calc(104px + env(safe-area-inset-top)) 32px 72px;}
.slw-left .sl-prow{margin:0 0 8px;gap:22px;}
.slw-left .sl-prow .nm{font-size:44px;}
.slw-left .sl-prow .tg{font-size:17px;max-width:34ch;}
.slw-h{font-family:var(--serif);font-weight:500;font-size:24px;letter-spacing:-.01em;margin:34px 0 8px;color:var(--ink);}
.slw-left .sl-detbtn{margin:16px 0 0;justify-content:flex-start;}
.slw-right{position:sticky;top:96px;}
.slw-card{background:var(--paper);border:1px solid var(--rule);border-radius:22px;padding:18px 20px 20px;box-shadow:0 30px 60px -44px rgba(20,16,25,.45);}
.slw-top{margin-bottom:14px;align-items:center;}
.slw-t{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3);}
.slw-buy{width:100%;justify-content:center;height:54px;font-size:16px;margin-top:16px;}
.slw-buy .p{opacity:.72;font-weight:500;margin-left:3px;}
.sl-wide ~ .sl-sheet{left:auto;right:max(24px,calc((100vw - 1120px)/2 + 32px));bottom:24px;border-radius:22px;width:440px;max-height:calc(100vh - 140px);}

/* ── checkout sheet (Shoplet style) ── */
.sl-sheet.sl-co{padding-bottom:0;}
.co-f select{width:100%;padding:11px 13px;border:1px solid var(--rule);border-radius:10px;font-size:15px;font-family:inherit;background:var(--paper);color:var(--ink);appearance:auto;}
.co-f select:disabled{opacity:.55;}
.co-f select:focus{outline:none;border-color:var(--blue);box-shadow:0 0 0 3px rgba(6,8,169,.08);}
.co-inline{display:flex;gap:8px;align-items:stretch;}
.co-for{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:var(--bone);border:1px solid var(--rule);border-radius:12px;padding:4px;margin-bottom:4px;}
.co-for button{padding:10px 8px;border-radius:9px;font-weight:600;font-size:14px;color:var(--ink-3);}
.co-for button.on{background:var(--paper);color:var(--ink);box-shadow:0 2px 7px rgba(20,16,25,.09);}
.co-planhint{margin:8px 0 4px;padding:10px 12px;border-radius:10px;background:var(--paper);border:1px solid var(--rule);font-size:13px;line-height:1.5;color:var(--ink-2);}
.co-planhint.err{border-color:var(--heat-text);}
.co-planhint a{color:var(--blue,#0608A9);font-weight:600;text-decoration:underline;text-underline-offset:3px;}
.co-inline input{flex:1;min-width:0;}
.co-send{flex:none;padding:0 14px;border-radius:10px;border:1.5px solid var(--blue);color:var(--blue);font-weight:600;font-size:13.5px;background:var(--paper);}
.co-send:disabled{opacity:.4;}
.co-ok2{flex:none;display:inline-flex;align-items:center;gap:5px;color:var(--recovery-deep);font-weight:600;font-size:13px;padding:0 4px;}
.co-code{width:100%;padding:11px 13px;border:1.5px solid var(--blue);border-radius:10px;font-size:20px;letter-spacing:.4em;text-align:center;font-family:var(--mono);background:var(--paper);color:var(--ink);}
.co-saved{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border:1px solid var(--rule);border-radius:12px;padding:11px 14px;background:var(--paper);font-size:13.5px;color:var(--ink);line-height:1.45;}
.co-saved em{display:flex;align-items:center;gap:4px;font-style:normal;font-size:12px;color:var(--recovery-deep);font-weight:600;margin-top:3px;}
.co-saved button{color:var(--blue);font-weight:600;font-size:13px;flex:none;}
.co-need select:invalid,.co-need .co-f input{border-color:var(--heat-text);}
.co-pays{grid-template-columns:1fr 1fr;}
.co-pay{align-items:flex-start;text-align:left;}
.co-pay .rd{margin-top:2px;}
.co-pay b{display:block;font-size:13.5px;font-weight:600;}
.co-pay small{display:block;font-size:11px;color:var(--ink-3);margin-top:1px;line-height:1.35;}
.co-tots{margin-top:16px;border-top:1px solid var(--rule);padding-top:8px;}
.co-tots>div{display:flex;justify-content:space-between;font-size:13.5px;color:var(--ink-2);padding:5px 0;}
.co-tots .good{color:var(--recovery-deep);font-weight:600;}
.co-tots .gold{color:var(--gold-text);font-weight:600;}
.co-tots .big{border-top:1px solid var(--rule);margin-top:6px;padding-top:10px;align-items:baseline;color:var(--ink);font-weight:600;}
.co-tots .big b{font-family:var(--serif);font-size:26px;font-weight:600;}
.co-tots .then{font-size:12px;color:var(--ink-3);display:block;text-align:right;}
.co-agree{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;color:var(--ink-2);line-height:1.45;margin-top:12px;cursor:pointer;}
.co-agree input{width:17px;height:17px;margin-top:1px;accent-color:var(--blue);flex:none;}
.co-agree.err{color:var(--heat-text);}
.co-link{font-size:13px;color:var(--blue);font-weight:600;text-decoration:underline;text-underline-offset:3px;margin-top:12px;}
.sl-co input,.sl-co select,.sl-co textarea{scroll-margin:90px 0 150px;}
.dc-alt{font-size:12px;color:var(--ink-3);line-height:1.45;margin-top:8px;}
.co-add{margin-top:10px;border-top:1px solid var(--rule);padding-top:4px;}
.co-add-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--rule);}
.co-add-row b{display:block;font-size:14px;color:var(--ink);font-weight:600;}
.co-add-row small{display:block;font-family:var(--mono);font-size:11px;color:var(--ink-3);margin-top:1px;}
.co-add-row .pr{font-family:var(--serif);font-size:16px;color:var(--ink);}
.co-add-row button{min-width:64px;padding:8px 12px;border-radius:100px;border:1.5px solid var(--blue);color:var(--blue);font-weight:600;font-size:13px;background:transparent;}
.co-add-foot{display:flex;justify-content:space-between;gap:12px;padding-top:10px;flex-wrap:wrap;}
.co-paywrap{position:sticky;bottom:0;background:linear-gradient(180deg,rgba(252,250,245,0),var(--paper) 22%);padding:16px 0 calc(12px + env(safe-area-inset-bottom));margin-top:4px;z-index:2;}
.co-paybtn{width:100%;justify-content:center;height:54px;font-size:16px;}
.co-paybtn:disabled{opacity:.7;}
.co-hint{font-size:12px;color:var(--heat-text);text-align:center;margin-top:7px;}
.co-fail{border:1.5px solid var(--heat-text);background:rgba(181,67,31,.06);border-radius:14px;padding:13px 14px;margin-bottom:14px;font-size:13px;color:var(--ink-2);line-height:1.45;}
.co-fail b{display:block;color:var(--heat-text);font-size:14px;margin-bottom:2px;}
.co-fail .cf-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;}
.co-fail .cf-btns button{padding:11px 8px;border-radius:100px;border:1.5px solid var(--ink);background:var(--paper);font-weight:600;font-size:13px;color:var(--ink);text-align:center;}
.co-fail .cf-btns button:first-child{background:var(--ink);color:var(--paper);}
.sl-qx{margin-left:auto;font-family:var(--mono);font-size:12px;color:var(--ink-3);}
.co-ok .co-next{border-top:1px solid var(--rule);margin:18px 0 16px;text-align:left;}
.co-ok .nx{flex:none;width:26px;font-family:var(--mono);font-size:12px;font-weight:600;color:var(--gold-text);padding-top:2px;}
.co-ok .sl-line{align-items:flex-start;}
.co-ok .ld2{font-size:12.5px;color:var(--ink-3);line-height:1.45;margin-top:2px;}
.co-ok p b{color:var(--ink);}
.co-pts{font-family:var(--serif);font-size:15px;color:var(--gold-text);} .co-pts b{font-size:30px;font-weight:600;}
.mini-card{position:relative;margin:4px auto 0;max-width:300px;aspect-ratio:1.586/1;border-radius:16px;background:linear-gradient(135deg,#0A31B4,#00249C 60%,#001a73);color:#fff;display:flex;flex-direction:column;justify-content:center;align-items:center;box-shadow:0 24px 50px -28px rgba(0,36,156,.8);}
.mini-card .mc-l{position:absolute;top:12px;right:14px;font-family:var(--mono);font-size:11px;letter-spacing:.12em;color:#F5B716;font-weight:600;}
.mini-card .mc-n{font-weight:700;font-size:19px;letter-spacing:.04em;}
.mini-card .mc-p{position:absolute;bottom:12px;left:14px;font-size:12px;color:#C3CEDC;} .mini-card .mc-p b{color:#F5B716;font-size:20px;font-family:var(--serif);margin-right:4px;}
@media(min-width:900px){.sl-wide ~ .sl-sheet.sl-co{width:480px;}}
@media(min-width:900px){.sl-wide ~ .sl-sheet:not(.on){transform:translateY(calc(100% + 60px));}}

.co-items{border:1px solid var(--rule);border-radius:12px;padding:2px 14px 10px;background:var(--paper);}
.co-items .sl-line:first-child{border-top:none;}
.co-again{color:var(--blue);font-weight:600;text-decoration:underline;font-family:inherit;font-size:inherit;}
.co-city{position:relative;}
.co-sugg{margin-top:6px;border:1px solid var(--rule);border-radius:12px;background:var(--paper);overflow:hidden;box-shadow:0 12px 30px -18px rgba(20,16,25,.35);}
.co-sugg button{display:flex;justify-content:space-between;gap:10px;width:100%;text-align:left;padding:12px 14px;border-top:1px solid var(--rule-soft);font-size:14.5px;color:var(--ink);}
.co-sugg button:first-child{border-top:none;}
.co-sugg button:hover,.co-sugg button:focus-visible{background:var(--bone);}
.co-sugg span{color:var(--ink-3);font-size:12.5px;white-space:nowrap;}
.co-pick{display:flex;justify-content:space-between;align-items:center;gap:10px;border:1px solid var(--blue);border-radius:10px;padding:11px 13px;background:var(--paper);font-size:14.5px;color:var(--ink);}
.co-pick span{color:var(--ink-3);} .co-pick b{color:var(--ink);font-weight:600;}
.co-pick button{color:var(--blue);font-weight:600;font-size:13px;}

`;

const NAV = [
  ["Home", "/"],
  ["The Science", "/science"],
  ["The System", "/system"],
  ["Shop", "/shop"],
  ["About", "/about"],
];
const APP_URL = "https://app.gutguard.ph"; /* BioScan / GLIS app — the logged-in product surface */
const GG_LOGO = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNTAzIDM0NCIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJHdXRndWFyZCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImdnTW9sZWN1bGUiIHgxPSIwLjE1IiB5MT0iMCIgeDI9IjAuNyIgeTI9IjEiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiMyNjI2REQiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMDcwNzc0Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgwLjAwMDAwMCwzNDQuMDAwMDAwKSBzY2FsZSgwLjEwMDAwMCwtMC4xMDAwMDApIiBmaWxsPSIjMTQxMDE5IiBzdHJva2U9Im5vbmUiPjxwYXRoIGQ9Ik0xNDI5NyAyOTYzIGMtNCAtMyAtNyAtMjE4IC03IC00NzcgMCAtMjU5IC00IC00NzcgLTkgLTQ4NCAtNiAtMTAKLTEyIC04IC0yMyAxMCAtNDYgNjggLTE3MSAxNzEgLTI1OSAyMTIgLTE0MSA2NiAtMzkyIDg3IC01NDkgNDYgLTMwNiAtNzkKLTUxNyAtMjk3IC01OTEgLTYxMCAtMTYgLTY5IC0xNiAtMzQ2IDAgLTQxNSA5NiAtNDEwIDQ0MyAtNjYxIDg3MSAtNjMwIDIyMAoxNiAzOTQgMTEwIDUzNyAyOTAgbDMyIDQwIDAgLTE1MiBjMSAtMTc5IC01IC0xNzAgMTE4IC0xNjMgbDg4IDUgMyAxMTU5IGMyCjkyMSAwIDExNjEgLTEwIDExNjggLTE2IDkgLTE5MiAxMSAtMjAxIDF6IG0tNDk0IC04NzQgYzI0MiAtMzcgNDQ0IC0yNTAgNDc4Ci01MDQgNTIgLTM5NSAtMTMyIC02OTIgLTQ3NCAtNzY2IC0xMTMgLTI0IC0xNDEgLTI0IC0yNTUgMSAtMTMzIDI4IC0yMTIgNzAKLTMwMyAxNjAgLTg1IDg1IC0xMTUgMTM0IC0xNTQgMjUwIC0zNyAxMTEgLTM5IDMyNSAtNSA0MzUgMTAwIDMxOCAzNjggNDc3CjcxMyA0MjR6Ii8+CjxwYXRoIGQ9Ik0xNDcwNSAyOTQ2IGMtMTU2IC03MCAtMTU3IC0yODAgLTEgLTM1MiA2MCAtMjggNzYgLTI5IDEzNiAtOCAxNjUKNTcgMTc3IDI5MiAxNyAzNTkgLTQ0IDE4IC0xMTIgMTkgLTE1MiAxeiBtMTYyIC0yNyBjODAgLTQ5IDEwOCAtMTQyIDY4IC0yMjIKLTg3IC0xNzUgLTMzNSAtMTEwIC0zMjMgODQgOSAxMjcgMTQ5IDIwMyAyNTUgMTM4eiIvPgo8cGF0aCBkPSJNMTQ3MTcgMjg2MyBjLTE1IC0xNSAtOCAtMTkzIDggLTE5MyAxMyAwIDIwIDE5IDE2IDQ0IC0yIDExIDE5IDM2CjMwIDM2IDUgMCAyMCAtMTggMzQgLTQwIDM1IC01NSA2MyAtNTYgMzUgLTEgLTE3IDM1IC0xOCA0MSAtNSA1NSAyMyAyMiAxOSA3MgotNyA5MCAtMjIgMTYgLTk5IDIyIC0xMTEgOXogbTkxIC0yNSBjMjEgLTIxIDE0IC01NyAtMTIgLTY0IC0zMyAtOCAtNDYgMiAtNDYKMzUgMCA0MSAzMCA1NyA1OCAyOXoiLz4KPHBhdGggZD0iTTExMTAgMjg2NCBjLTQzNCAtNTUgLTc3OCAtMjkxIC05NDUgLTY0OCAtMTkgLTQxIC0zNSAtODAgLTM1IC04NiAwCi02IC00IC0xOCAtOSAtMjggLTkgLTE3IC0xNyAtNDYgLTQyIC0xNTIgLTE4IC03MyAtMTggLTM3OCAtMSAtNDQ1IDQwIC0xNTMKNTkgLTIxMCAxMDMgLTI5OCAxNTUgLTMwOCA0MzIgLTUxNiA4MDUgLTYwNCAxMjYgLTI5IDQ3MiAtMjYgNjE0IDUgMjU3IDU4CjU2OSAyMDAgNTg2IDI2NiAyIDEyIDMgMjE1IDIgNDUxIGwtMyA0MzAgLTIzNSAwIC0yMzUgMCAtMyAtMzI2IC0yIC0zMjcgLTY1Ci0yNiBjLTI2OSAtMTA4IC01NzEgLTc3IC03OTEgNzkgLTI2MiAxODggLTM0OSA1OTUgLTE5NCA5MTAgMjAzIDQxMiA3OTcgNTAzCjExNzQgMTgwIDYzIC01MyA2MSAtNTMgMTA3IC0xMiAxMDYgOTQgMjc0IDI1MSAyNzcgMjU3IDQgMTEgLTEzMSAxMzUgLTE5OQoxODAgLTEyNiA4NiAtMzE4IDE2MSAtNDYzIDE4MCAtNDQgNiAtMTExIDE1IC0xNDggMjEgLTg1IDEyIC0xNjYgMTAgLTI5OCAtN3oiLz4KPHBhdGggZD0iTTQ4NzkgMjY3OCBjLTEgLTEzIDAgLTEwMiAxIC0xOTkgMSAtMTM5IC0xIC0xNzggLTEyIC0xODcgLTkgLTcgLTYyCi0xMiAtMTM0IC0xNCBsLTExOSAtMyAwIC0xODAgMCAtMTgwIDEyMCAtMyBjOTggLTIgMTIyIC01IDEzMyAtMTkgOSAtMTMgMTIKLTExMiAxMiAtNDE1IDAgLTQ0MyA0IC00NzcgNzEgLTYxMSA2MiAtMTIxIDIxMCAtMjI1IDM2OSAtMjU4IDk0IC0yMCAzMTggLTE3CjQwMCA1IDg1IDIzIDE3NyA2NCAxODQgODMgOCAxOSAtMTE1IDMzMyAtMTI5IDMzMyAtNyAwIC0yNiAtNyAtNDQgLTE2IC0xNyAtOAotNTkgLTIwIC05NCAtMjUgLTEzNCAtMTkgLTIyMCAyNSAtMjU2IDEzMCAtMTMgMzkgLTE2IDc1OCAtMyA3NzggNiA5IDY0IDEzCjIxMiAxNSBsMjA1IDMgMCAxODAgMCAxODAgLTIxMCA1IC0yMTAgNSAtMyAyMDggLTIgMjA3IC0yNDUgMCAtMjQ1IDAgLTEgLTIyeiIvPgo8cGF0aCBkPSJNNzE0NSAyMzU0IGMtMTM5IC0xOSAtMTg2IC0zMCAtMjYxIC01OSAtMjIwIC04NiAtMjMxIC0xMzYgLTM2IC0xNzEKNjEgLTExIDgzIC0xMSAxNTAgMiAxNjQgMzIgMjAwIDM1IDMwNyAzMCAyODkgLTE0IDUwOSAtMTgyIDU4MiAtNDQyIDI0IC04NQoyNCAtMjgwIDAgLTM1OSAtOTQgLTMxMCAtMzc1IC00ODQgLTcyMCAtNDQ1IC0yNjUgMzAgLTQ0OCAxNzcgLTUzNyA0MzAgLTggMjAKLTE0IDEwNiAtMTcgMjA1IC0yIDExMSAtOSAxODcgLTE5IDIyMCAtMTcgNTggLTg1IDE4NyAtMTAwIDE5MiAtMTUgNSAtNjgKLTEwOCAtODcgLTE4MyAtMzUgLTEzOCAtNDIgLTIwOSAtMjkgLTMyMiA0MiAtMzY4IDI0OSAtNjEyIDYwOSAtNzE5IDEyOCAtMzgKMzY3IC0zOCA0ODkgMCAxNjEgNTAgMjU1IDEwNyAzNTMgMjEzIDM0IDM3IDY0IDY1IDY3IDYyIDEyIC0xMyA0IC0zMDYgLTExCi0zODEgLTU4IC0zMDMgLTIzOSAtNDMyIC02MTAgLTQzMiAtMjUzIDAgLTQwNyA0MyAtNTk2IDE2NiAtNDEgMjcgLTc5IDQ5IC04NQo0OSAtNSAwIC0zMiAtMzUgLTYxIC03NyAtNDggLTc0IC01MCAtNzkgLTM1IC05NyA0NSAtNTEgMjIxIC0xNDYgMzIyIC0xNzUgMjUKLTcgNTYgLTE3IDcwIC0yMSA5MiAtMzAgMTQ2IC0zNSAzODUgLTM1IDI1MSAwIDI3MSAyIDM5MyA0MSAxNjYgNTQgMzA3IDE4MQozNzcgMzM5IDkgMjIgMjEgNDkgMjYgNjAgNSAxMSAxOSA1OCAzMSAxMDUgMjIgODQgMjIgOTUgMjUgOTM0IDMgNjg1IDEgODUxCi05IDg1OCAtNyA0IC01MiA4IC0xMDAgOCAtMTExIDAgLTExMCAxIC0xMDcgLTE3MSAxIC03MSAtMSAtMTMyIC01IC0xMzYgLTQKLTQgLTE5IDggLTMzIDI3IC05NiAxMjUgLTI1NiAyMjUgLTQyOCAyNjUgLTYyIDE1IC0yNDcgMjcgLTMwMCAxOXoiLz4KPHBhdGggZD0iTTI2MzMgMjMyNCBjLTIwIC05IC0xOCAtMTAxMyAyIC0xMTQ5IDQ2IC0zMTUgMjMyIC01MTAgNTQ0IC01NjkgMjM3Ci00NSA0NjcgOCA2MzIgMTQ2IDMzIDI3IDYzIDQ4IDY2IDQ1IDMgLTMgNiAtNDMgNyAtODkgbDEgLTgzIDIzMyAtMyAyMzIgLTIKLTIgODQ3IC0zIDg0OCAtMjQyIDMgLTI0MSAyIC01IC00ODIgYy00IC00OTkgLTYgLTUyNyAtNDggLTYxNyAtMTE1IC0yNDcKLTUyNiAtMjc5IC02NDIgLTQ5IC01MyAxMDUgLTU3IDE1NiAtNTcgNjc0IGwwIDQ3NCAtMTc0IDAgYy05NSAwIC0yMDAgMiAtMjMyCjUgLTMyIDIgLTY1IDIgLTcxIC0xeiIvPgo8cGF0aCBkPSJNMTA4NTUgMjI5MCBjLTE4MiAtMTYgLTM4NSAtOTAgLTUxMiAtMTg2IC00MSAtMzEgLTQxIC0zMCAzIC0xMDMgNTIKLTg3IDU3IC05MCAxMDcgLTU0IDE0MSAxMDIgMzA4IDE1MyA0OTcgMTUzIDIxMyAwIDM0NCAtNjEgNDE5IC0xOTQgNDggLTg1IDgwCi0zMDMgNDkgLTMzNCAtOSAtOSAtOTcgLTEyIC0zMzQgLTEyIC0zMzcgMCAtNDEwIC03IC01MzkgLTUzIC0zMDEgLTEwNyAtMzgzCi01MDcgLTE1MiAtNzM4IDIyOCAtMjI5IDc5OCAtMjAzIDk4OCA0NCAxOCAyMyAzNCA0NCAzNiA0NyAxMyAxNiAyMiAtMzcgMTkKLTExNSAtNCAtMTI0IC0zIC0xMjUgOTUgLTEyNSAxMzIgMCAxMTkgLTY0IDExOSA1NjEgMCA1MDQgLTEgNTQ4IC0yMCA2NDAgLTQ3CjIyOCAtMTYyIDM2MyAtMzcxIDQzNCAtNjIgMjEgLTI0OCA0OCAtMjk5IDQ0IC04IC0xIC01NSAtNSAtMTA1IC05eiBtNTczCi0xMDMyIGMzIC0xMjUgMiAtMTI4IC0yOSAtMTkwIC0zMyAtNjYgLTEyMSAtMTY1IC0xNzUgLTE5OSAtMTU3IC05NyAtNDA4Ci0xMTUgLTU2NSAtNDAgLTEzNCA2MyAtMTc0IDEyNCAtMTc0IDI2NSAwIDE1NSA0NyAyMTkgMTk2IDI3MCA3NCAyNiA3NCAyNgo0MDkgMjMgbDMzNSAtMiAzIC0xMjd6Ii8+CjxwYXRoIGQ9Ik04NTA3IDIyODMgYy0yNSAtNyAtMjAgLTEwNzcgNiAtMTE3OCA3OSAtMzExIDI4NiAtNDc2IDYxNyAtNDkyIDI3OQotMTQgNDcxIDY3IDYyNyAyNjIgbDMyIDQwIDAgLTEzMiBjMSAtNzIgNCAtMTM4IDcgLTE0NyA3IC0xNyAxNzYgLTI0IDIwMiAtOAoxMCA3IDEyIDE3OSAxMCA4MjggbC0zIDgxOSAtMTEyIDMgLTExMSAzIC00IC01MTggLTMgLTUxOCAtMjcgLTcyIGMtNTUgLTE1MgotMTM0IC0yNDYgLTI1OCAtMzA2IC0yNzYgLTEzMiAtNjA4IC00OCAtNzE4IDE4NCAtNTIgMTA5IC01NCAxNDEgLTU4IDcwMyAtMwo0MDYgLTYgNTIxIC0xNiA1MjggLTE0IDggLTE2MCA5IC0xOTEgMXoiLz4KPHBhdGggZD0iTTEyNjgwIDIyODMgYy0xNTkgLTI3IC0zMDkgLTExNiAtMzkxIC0yMzQgLTIzIC0zMyAtNDYgLTU2IC01MCAtNTIKLTUgNSAtMTAgNjkgLTExIDE0MyBsLTMgMTM1IC0xMDAgMCAtMTAwIDAgLTMgLTgyMiAtMiAtODIzIDIzIC02IGMxMyAtMyA2MgotNCAxMDggLTIgbDg0IDMgNiA0OTUgYzQgMjg5IDExIDUxNCAxNyA1NDAgNTkgMjU1IDIzNCA0MDMgNDkyIDQxOSBsOTUgNiAzCjEwMyAzIDEwMiAtNzMgLTEgYy00MCAtMSAtODQgLTQgLTk4IC02eiIvPjwvZz4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgwLjAwMDAwMCwzNDQuMDAwMDAwKSBzY2FsZSgwLjEwMDAwMCwtMC4xMDAwMDApIiBmaWxsPSJ1cmwoI2dnTW9sZWN1bGUpIiBzdHJva2U9Im5vbmUiPjxwYXRoIGQ9Ik02ODk0IDMzOTEgYy01NSAtOSAtMTI2IC01MyAtMTYxIC05OCAtNTAgLTY0IC02MyAtMTIxIC03OCAtMzQzIC0xMgotMTYwIC00MSAtMTgwIC0yODkgLTE5MiAtMTgzIC05IC0yMzQgLTIwIC0zMDcgLTY3IC05MSAtNTggLTEzNiAtMTI1IC0xNjQKLTI0NiAtMzcgLTE1OSA1NCAtMzMzIDIxMSAtNDA3IDU4IC0yNyA3NyAtMzEgMjEyIC0zOCAzMDIgLTE2IDMyMyAtMzggMzMzCi0zNjAgNyAtMjE2IDE0IC0yNTEgNzAgLTM2MCAyNiAtNTAgMTUyIC0xODAgMTk0IC0yMDAgMTcgLTggNDEgLTIxIDU0IC0yOSA4MQotNTEgMjc2IC02NSAzOTUgLTMwIDE5NCA1OCAzMDEgMTYzIDM4NyAzNzkgMjUgNjMgMTkgMjg0IC05IDM0NSAtNTcgMTIyIC03MQoxNDQgLTEzOSAyMTIgLTEzNCAxMzQgLTI2NSAxNzEgLTUyMyAxNTAgLTQxIC0zIC05MyAtMTEgLTExNSAtMTYgLTExMyAtMjkKLTIxNCAtNiAtMjQwIDU2IC05IDIxIC0yNCA0NyAtMzQgNTggLTI5IDMyIC00MSAxMTggLTQ0IDMwNSAtMyAyNDkgMTAgMjYzCjI0OSAyODEgMjExIDE2IDMxMyA2NyAzNzAgMTg2IDczIDE1NCAyOSAzMDYgLTExMiAzODkgLTQ0IDI2IC0xNzkgMzkgLTI2MCAyNXoiLz48L2c+Cjwvc3ZnPg==";
function Logo({ h = 26, className, style }) {
  return <img src={GG_LOGO} alt="Gutguard" className={className} style={{ height: h, width: "auto", display: "block", ...(style || {}) }} />;
}
const DISEASE_FACTORY_URL = "/disease-factory.html"; /* standalone interactive — opens in its own page */

/* ───────────── Pricing and dose — one source (Addendum 01 §9, updated by Addenda 02–03) ─────────────
   Production: move to config/pricing.ts. The server recalculates every price; the page only displays. */
const PROTO_LABEL = "90-Day Protocol"; /* was "Cellular Regeneration & Anti-Aging Program" — pending Dr. Sinchioco */
const LIFESTYLE_JOIN = "https://claude.ai/artifact/9tPTTKyCSRCkaeFwuMku3J"; /* production: /lifestyle/join */
const LIFESTYLE_HOME = "https://claude.ai/artifact/GGYfp5cEpWgJDezFRfKrWK"; /* production: /lifestyle */
/* Links: a page on this site stays in this tab; another page (Lifestyle, landing) opens in a new tab. */
/* Forms: the field being filled is always in view, and the next field comes up by itself. */
const focusNext = (id) => setTimeout(() => { const el = document.getElementById(id); if (el && !el.disabled) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } bringIntoView(el); } }, 80);
const bringIntoView = (el) => {
  const vv = window.visualViewport; const vh = vv ? vv.height : window.innerHeight;
  const r = el.getBoundingClientRect(); const pay = document.querySelector(".sl-co.on .co-paywrap"); const bottomGap = (pay ? pay.offsetHeight : 0) + 24;
  if (r.top >= 90 && r.bottom <= vh - bottomGap) return;
  const sc = el.closest(".sl-co.on");
  if (sc) { /* inside the checkout sheet: put the field about a third of the way down the space above the Pay button */
    const sr = sc.getBoundingClientRect(); const room = Math.min(vh, (pay ? pay.getBoundingClientRect().top : vh)) - sr.top;
    sc.scrollTo({ top: sc.scrollTop + (r.top - sr.top) - Math.max(16, room * 0.3), behavior: "smooth" });
  } else el.scrollIntoView({ block: "center", behavior: "smooth" });
};
const linkTo = (h) => (/^https?:/.test(h) ? { href: h, target: "_blank", rel: "noopener" } : { href: h });
/* The artifact viewer passes only a plain #word to a linked page (letters, digits . _ ~ -), so links from the Lifestyle pages
   use tokens: #shop~who-sub~tab-protocol → /shop?who=sub&tab=protocol. Production: normal URLs on one domain. */
const normHash = (h) => { h = (h || "").replace(/^#/, ""); if (/^shop(~|$)/.test(h)) { const q = h.split("~").slice(1).map((x) => x.replace("-", "=")).join("&"); return "/shop" + (q ? "?" + q : ""); } return h || "/"; };
const joinUrl = (from) => LIFESTYLE_JOIN + "#" + from;      /* from: footer | shop | login */
/* member links carry the member's stage (demo only) and one action: member | continue | plan-keep | buy-peak …
   production: /lifestyle reads the stage from the session and the action from the hash */
const memberUrl = (hash, who) => LIFESTYLE_HOME + "#" + (who === "trial" ? "trial" : who === "peak" ? "member" : "member") + "~" + hash;

const GOALS = [
  { id: "keep",   goal: "Keep healthy",  level: "Maintenance", glis: "Moderate",      perDay: 2, rev: 1, mid: 0, taps: 1, mo: 6,  q: 18 },
  { id: "better", goal: "Feel better",   level: "Support",     glis: "Slightly High", perDay: 4, rev: 2, mid: 0, taps: 2, mo: 12, q: 36 },
  { id: "full",   goal: "Full recovery", level: "Intensive",   glis: "High",          perDay: 6, rev: 2, mid: 2, taps: 2, mo: 18, q: 54 },
];
const MONTHLY = 989, QUARTERLY = 890; /* Every 3 months sits on the ₱89/capsule price floor, same as Peak */               /* per blister; 1 blister = 10 capsules */
const TRIAL_OFFER = { price: 499, caps: 10, nights: 5 };   /* first purchase only · free shipping */
const PEAK = { price: 29369, caps: 330, perCap: 89 };      /* ₱88.997 → shown ₱89; buyer pays shipping */
const OTHER = [
  { id: "blister", name: "1 blister", caps: 10, price: 1499 },
  { id: "bottle",  name: "Bottle",    caps: 30, price: 3799 },
  { id: "start",   name: "Start",     caps: 30, price: 3999 },
  { id: "grow",    name: "Grow",      caps: 90, price: 10999 },
];
const PHASES = [
  ["Repair", "Weeks 1–4. Start at your level.", "Reseat the gut microbiome and support the barrier — the foundation."],
  ["Calm", "Weeks 5–8. Your dose steps down as your score improves.", "As the gut settles, systemic inflammation eases — where your GLIS begins to move."],
  ["Regenerate", "Weeks 9–12. Hold your gains.", "With inflammation down, the Gut-Mitochondrial Axis re-engages — recovery, powered."],
];
const peso = (n) => "₱" + n.toLocaleString("en-PH");

/* ---- visitor state ---- production: read from the session. The demo chip switches it. */
const VisitorCtx = createContext({ who: "guest", setWho: () => {}, failNext: false, setFailNext: () => {}, usedBefore: false, setUsedBefore: () => {} });
const useVisitor = () => useContext(VisitorCtx);
const VISITORS = [
  ["guest", "New visitor"],
  ["card", "Card-only member (no order yet)"],
  ["trial", "Trial member (no plan yet)"],
  ["sub", "Gutguard Daily subscriber"],
  ["peak", "Peak buyer"],
];
const isMember = (who) => who !== "guest";

/* signature motion: measurement numbers resolve into view (the "we measure" feel) */
function CountUp({ to, from = 0, prefix = "", suffix = "", dur = 1300 }) {
  const [val, setVal] = useState(from);
  const ref = useRef(null);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setVal(to); return; }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !done.current) {
          done.current = true;
          const t0 = performance.now();
          const tick = (now) => {
            const p = Math.min(1, (now - t0) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(Math.round(from + (to - from) * eased));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      });
    }, { threshold: 0.6 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, from, dur]);
  return <span ref={ref}>{prefix}{val}{suffix}</span>;
}

/* brand iconography — one rounded line language with node accents that echo the logo molecule */
function Svg({ size = 24, sw = 1.7, children }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}
const IconGuard = ({ size }) => <Svg size={size}><path d="M12 2.6 L19.4 5.6 V11 C19.4 15.7 16.1 19.1 12 21.3 C7.9 19.1 4.6 15.7 4.6 11 V5.6 Z" /><path d="M8.7 11.7 L11 14 L15.4 9.3" /></Svg>;
const IconClinical = ({ size }) => <Svg size={size}><circle cx="12" cy="12" r="8.4" /><path d="M12 8 V16 M8 12 H16" /></Svg>;
const IconPeople = ({ size }) => <Svg size={size}><circle cx="8.6" cy="8" r="3" /><circle cx="15.4" cy="8" r="3" /><path d="M3.8 19 C3.8 15.4 5.9 13.8 8.6 13.8 C9.7 13.8 10.6 14.1 11.3 14.7" /><path d="M12.7 14.7 C13.4 14.1 14.3 13.8 15.4 13.8 C18.1 13.8 20.2 15.4 20.2 19" /></Svg>;
const IconNetwork = ({ size }) => <Svg size={size}><path d="M6 6.4 L18 6.4 M6 6.4 L12 17.3 M18 6.4 L12 17.3" /><circle cx="6" cy="6.4" r="2.35" fill="currentColor" stroke="none" /><circle cx="18" cy="6.4" r="2.35" fill="currentColor" stroke="none" /><circle cx="12" cy="17.3" r="2.35" fill="currentColor" stroke="none" /></Svg>;
const IconPin = ({ size }) => <Svg size={size}><path d="M12 21.2 C12 21.2 5.6 14.6 5.6 9.6 A6.4 6.4 0 0 1 18.4 9.6 C18.4 14.6 12 21.2 12 21.2 Z" /><circle cx="12" cy="9.6" r="2.2" fill="currentColor" stroke="none" /></Svg>;
const IconPulse = ({ size }) => <Svg size={size}><path d="M2.5 12.5 H6.6 L9.2 6 L12.9 17.6 L15.4 12.5 H21.5" /><circle cx="21.5" cy="12.5" r="1.5" fill="currentColor" stroke="none" /></Svg>;

/* signature illustration — the SynBIOTIC+ capsule: inflammation (heat) → recovery (blue), bridged by the biotic molecule */
function IllustCapsule({ className, style }) {
  return (
    <svg className={className} style={style} viewBox="52 78 376 124" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="capHeat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FF8A6B" /><stop offset="1" stopColor="#E24A22" /></linearGradient>
        <linearGradient id="capRec" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4FA3DE" /><stop offset="1" stopColor="#1E6FB8" /></linearGradient>
        <clipPath id="capPill"><rect x="70" y="95" width="340" height="90" rx="45" /></clipPath>
      </defs>
      <g clipPath="url(#capPill)">
        <rect x="70" y="95" width="172" height="90" fill="url(#capHeat)" />
        <rect x="238" y="95" width="172" height="90" fill="url(#capRec)" />
        <ellipse cx="150" cy="120" rx="90" ry="16" fill="#fff" opacity="0.22" />
        <ellipse cx="320" cy="120" rx="90" ry="16" fill="#fff" opacity="0.22" />
        <g stroke="#FCFAF5" strokeWidth="3" fill="#FCFAF5">
          <line x1="205" y1="140" x2="240" y2="128" /><line x1="240" y1="128" x2="275" y2="150" /><line x1="240" y1="128" x2="248" y2="108" />
          <circle cx="205" cy="140" r="8" /><circle cx="240" cy="128" r="10" /><circle cx="275" cy="150" r="8" /><circle cx="248" cy="108" r="6" />
        </g>
        <rect x="238" y="95" width="4" height="90" fill="#FCFAF5" />
      </g>
      <rect x="70" y="95" width="340" height="90" rx="45" fill="none" stroke="#141019" strokeOpacity="0.14" strokeWidth="2" />
    </svg>
  );
}

/* signature molecular constellation — the node motif as ambient texture (logo → icons → data-viz → decoration) */
function Constellation() {
  return (
    <svg className="constellation" viewBox="0 0 100 58" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="ggNode" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF5E3A" /><stop offset=".5" stopColor="#B08D5B" /><stop offset="1" stopColor="#2F86C9" />
        </linearGradient>
      </defs>
      <g stroke="#2F86C9" strokeWidth="0.18" opacity="0.42">
        <line x1="12" y1="14" x2="27" y2="9" /><line x1="12" y1="14" x2="20" y2="30" /><line x1="27" y1="9" x2="38" y2="22" />
        <line x1="20" y1="30" x2="38" y2="22" /><line x1="38" y1="22" x2="50" y2="12" /><line x1="38" y1="22" x2="46" y2="38" />
        <line x1="50" y1="12" x2="63" y2="26" /><line x1="46" y1="38" x2="63" y2="26" /><line x1="63" y1="26" x2="74" y2="15" />
        <line x1="63" y1="26" x2="70" y2="44" /><line x1="74" y1="15" x2="87" y2="30" /><line x1="70" y1="44" x2="84" y2="50" />
        <line x1="87" y1="30" x2="84" y2="50" /><line x1="46" y1="38" x2="34" y2="48" /><line x1="34" y1="48" x2="52" y2="52" />
        <line x1="52" y1="52" x2="70" y2="44" /><line x1="20" y1="30" x2="34" y2="48" />
      </g>
      <g fill="#2F86C9" opacity="0.5">
        <circle cx="12" cy="14" r="0.6" /><circle cx="27" cy="9" r="0.5" /><circle cx="20" cy="30" r="0.55" />
        <circle cx="50" cy="12" r="0.6" /><circle cx="74" cy="15" r="0.55" /><circle cx="87" cy="30" r="0.6" />
        <circle cx="34" cy="48" r="0.5" /><circle cx="84" cy="50" r="0.55" /><circle cx="70" cy="44" r="0.5" />
      </g>
      <g fill="url(#ggNode)" className="cn-hero">
        <circle cx="38" cy="22" r="1.5" /><circle cx="63" cy="26" r="1.7" /><circle cx="46" cy="38" r="1.3" /><circle cx="52" cy="52" r="1.2" />
      </g>
    </svg>
  );
}

/* modern-lifestyle inflammation triggers (PH-localized) */
const TRIGGERS = [
  ["01", "Ultra-processed food", "+50% heart-disease death", "Energy-dense meals and sweet drinks flood the liver faster than it can clear.", "Visceral fat & inflammatory load"],
  ["02", "Chronic stress", "≈2× heart-attack risk", "Money worries, work that never switches off, and a mind that won't stop at night.", "Cortisol keeps the fire lit"],
  ["03", "Too little sleep", "+48% heart-disease risk", "Most of us run below the 7–9 hours the body needs to repair.", "Repair never finishes"],
  ["04", "Sedentary days", "up to +59% mortality risk", "Eight-plus hours seated, in office and screen culture.", "Less cellular renewal"],
  ["05", "Environmental load", "99% breathe unsafe air", "Air pollution now exceeds safe limits for almost everyone on Earth.", "Oxidative stress"],
  ["06", "Gut disruptors", "9 gut species still gone at 6 months", "One course of antibiotics can strip beneficial microbes that don't fully return.", "Gut–mitochondria axis disrupted"],
];

/* SynBIOTIC+ composition — 17 live strains. Wellness / structure-function language only; no disease claims. */
const STRAINS = [
  ["L. acidophilus", "A cornerstone strain; supports healthy gut microflora and everyday digestion."],
  ["L. rhamnosus", "Supports the gut lining and a healthy inflammatory response."],
  ["L. plantarum", "Helps maintain gut balance, including during antibiotic use, and supports nutrient absorption."],
  ["L. casei", "Supports digestive regularity and immune balance."],
  ["L. paracasei", "Supports digestive function and gut microbial balance."],
  ["L. bulgaricus", "A classic yogurt culture; supports a settled, balanced gut."],
  ["L. reuteri", "Supports the gut's natural balance and everyday immune resilience."],
  ["L. gasseri", "Supports immune balance and healthy digestion."],
  ["L. salivarius", "Supports gut microbial balance and calmer inflammatory signaling."],
  ["L. fermentum", "Supports good digestive activity and antioxidant defense."],
  ["L. brevis", "A resilient lactic-acid strain that supports a balanced gut."],
  ["B. coagulans (LactoSpore®)", "The spore-forming strain (formerly named L. sporogenes); its spore coat survives stomach acid to reach the gut."],
  ["L. helveticus", "Studied for the gut–brain axis; supports a balanced stress response."],
  ["L. sakei", "Supports the body's natural microbial balance."],
  ["L. buchneri", "A fermentation strain that adds to the formula's microbial diversity."],
  ["L. iners", "A naturally occurring, human-associated strain contributing to microbial diversity."],
  ["L. jensenii", "A naturally occurring, human-associated strain that supports microbial balance."],
];

/* per-page section jump-nav — shown persistently under the nav */
const SECTIONS = {
  "/": [["Why now", "why-now"], ["The cost", "cost"], ["Protocol", "protocol"], ["Your dose", "dose"], ["Evidence", "evidence"]],
  "/science": [["Mechanism", "mechanism"], ["Triggers", "triggers"], ["Measure", "measure"], ["Standard", "standard"]],
  "/system": [["The Stack", "stack"], ["Proof", "proof"], ["Two Reads", "readings"]],
};

/* full site map — pages + their sections, for the footer overview + "you are here" */
const SITEMAP = [
  ["Home", "/", [["Why now", "why-now"], ["The cost", "cost"], ["The protocol", "protocol"], ["Your dose", "dose"], ["Evidence", "evidence"]]],
  ["The Science", "/science", [["Mechanism", "mechanism"], ["Triggers", "triggers"], ["How we measure", "measure"], ["The standard", "standard"]]],
  ["The System", "/system", [["The stack", "stack"], ["Proof", "proof"], ["Two reads", "readings"]]],
  ["Shop", "/shop", [["Buy SynBIOTIC+", "buy"]]],
  ["For Physicians", "/physicians", [["What you'd practice", "practice"], ["Recovery rationale", "rationale"]]],
  ["About", "/about", [["Mission", "mission"], ["What we do", "what"], ["Credentials", "credentials"], ["People", "people"]]],
];

const Arrow = () => <span className="arr"><ArrowRight size={13} /></span>;

/* ── reveal-on-scroll, re-run whenever the route changes ── */
function useReveal(dep) {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = Array.from(document.querySelectorAll(".reveal:not(.in)"));
    if (reduce) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [dep]);
}

function Nav({ route, scrolled, open, setOpen, sheetRef, burgerRef }) {
  const here = (SITEMAP.find(([, r]) => r === route) || [])[0];
  const { who } = useVisitor();
  const member = isMember(who);
  return (
    <>
      <nav className={"nav" + (scrolled ? " scrolled" : "")} aria-label="Primary">
        <div className="nav-inner">
          <div className="nav-lead">
            {route !== "/" && <button className="nav-back" aria-label="Go back to the previous screen" onClick={() => window.history.back()}><ArrowLeft size={18} /></button>}
            <a className="brand" href="#/" aria-label="Gutguard home"><Logo h={26} /></a>
            {here && <span className="nav-here" aria-hidden="true">{here}</span>}
          </div>
          <div className="nav-links">
            {NAV.map(([l, r]) => (
              <a key={r} href={"#" + r} aria-current={route === r ? "page" : undefined}>{l}</a>
            ))}
          </div>
          {!member && <a className="nav-login" href={joinUrl("login")} target="_blank" rel="noopener" aria-label="Log in to your Lifestyle page">Log in</a>}
          <a className="nav-cta" {...linkTo(member ? memberUrl("member", who) : "#/shop?start=watch")}>{member ? "My Lifestyle" : "Start my 5 nights"} <ArrowRight size={14} /></a>
          <button ref={burgerRef} className="burger" aria-label="Open menu" aria-haspopup="dialog" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
        </div>
      </nav>
      <div id="mobile-menu" ref={sheetRef} className={"sheet" + (open ? " open" : "")} role="dialog" aria-modal="true" aria-label="Site menu">
        <button className="burger sheet-close" aria-label="Close menu" onClick={() => setOpen(false)}><X size={20} /></button>
        {NAV.map(([l, r], i) => (
          <a key={r} href={"#" + r} aria-current={route === r ? "page" : undefined} onClick={() => setOpen(false)}>
            <em>{String(i + 1).padStart(2, "0")}</em>{l}
          </a>
        ))}
        <a className="nav-cta" {...linkTo(member ? memberUrl("member", who) : "#/shop?start=watch")} onClick={() => setOpen(false)}>{member ? "My Lifestyle" : "Start my 5 nights · ₱499"} <ArrowRight size={16} /></a>
        {!member && <a className="sheet-login" href={joinUrl("login")} target="_blank" rel="noopener">Already a member? Log in to your Lifestyle page →</a>}
      </div>
    </>
  );
}

function Footer({ route, goTo }) {
  return (
    <footer>
      <div className="wrap">
        <nav className="sitemap" aria-label="Site map">
          {SITEMAP.map(([label, r, secs]) => (
            <div className={"smap-col" + (route === r ? " here" : "")} key={r}>
              <a className="smap-head" href={"#" + r} aria-current={route === r ? "page" : undefined}>
                {label}
                {route === r && <span className="smap-you">You are here</span>}
              </a>
              <ul className="smap-list">
                {secs.map(([sl, id]) => (
                  <li key={id}><button type="button" className="smap-sec" onClick={() => goTo(r, id)}>{sl}</button></li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="foot-inner">
          <div className="foot-brand">
            <Logo h={30} />
            <div className="cry">We Gut You.</div>
          </div>
          <nav className="foot-nav" aria-label="Footer">
            <a href="#/about">About Gutguard</a>
            <a href={joinUrl("login")} target="_blank" rel="noopener">Log in to your Lifestyle page</a>
            <a href="#/legal">Terms of Sale · Subscription Terms · Refund Policy · Privacy Notice</a>
          </nav>
          <div className="foot-legal">
            GUTGUARD CORPORATION<br />
            FDA CPR No. FR-40000015571456 · LTO-30000007262499<br />
            Davao City · Philippines · 20 branches
          </div>
        </div>
      </div>
    </footer>
  );
}

function TrustStrip() {
  const items = [["FDA", "Registered · CPR FR-400…456"], ["USAID", "Funded science"], ["MSU-IIT", "Co-developed R&D"], ["20", "Branches nationwide"], ["80B", "CFU · 17 strains"]];
  return (
    <section className="trust"><div className="wrap"><div className="trust-grid reveal">
      {items.map(([n, l]) => <div className="trust-item" key={l}><div className="n">{n}</div><div className="l">{l}</div></div>)}
    </div></div></section>
  );
}

function Compliance() {
  return (
    <section className="section" style={{ paddingTop: 0 }}><div className="wrap">
      <div className="compliance reveal">
        <div className="comp-seal"><IconGuard size={26} /></div>
        <div className="comp-txt">
          <h3>Honest by design</h3>
          <div className="b">Across every page, we describe effects on <em>inflammation, not disease</em>, and we don’t overstate what the product does. For personal health decisions, consult a licensed physician.</div>
        </div>
      </div>
    </div></section>
  );
}

function MeasureSection({ heading = true }) {
  return (
    <section className="section measure"><Constellation /><div className="wrap">
      {heading && (
        <div className="reveal">
          <div className="sec-label" id="your-number"><span className="num">03</span> Your number</div>
          <h2 className="sec">One number you’ll remember: <em>your MiAge.</em></h2>
          <p className="sec-sub">From the lab tests you already have, we read two things. Your Lifestyle Inflammation Score (GLIS) measures low-grade chronic systemic inflammation — what doctors track with markers like hs-CRP, and what science calls inflammaging as it builds with age.<sup><a href="#ref2">2</a></sup> It reads as a cardiometabolic composite: not just inflammatory markers, but the metabolic sources that fuel them, like visceral fat and insulin resistance. Your MiAge then translates that into a biological age in years, set against your real age.</p>
        </div>
      )}
      <div className="miage-block reveal">
        <div className="miage-hero">
          <span className="mh-label">MiAge · Mitochondrial Age <span className="mh-beta">Beta</span></span>
          <div className="mh-num"><CountUp to={48} /><span>yrs</span></div>
          <p className="mh-desc">Mitochondria are your cells’ engine and repair system. Chronic inflammation wears them down, and worn mitochondria fuel more inflammation — a loop aging science treats as a core driver of how fast we age.<sup><a href="#ref9">9</a></sup> Because mitochondrial decline is a hallmark of that aging,<sup><a href="#ref11">11</a></sup> we name your biological age after it. Calendar age 41, MiAge 48 means your body may be running about seven years ahead — a gap to close, not a diagnosis.</p>
        </div>
        <div className="miage-supports">
          <div className="ms-card">
            <span className="ms-name">Blood Scan <small>BioScan</small></span>
            <p>Upload or photograph the blood test results you already have. The system reads your biomarkers from a routine, affordable panel — no special kit, no partner lab, and none of the costly DNA testing other biological-age clocks require.</p>
          </div>
          <div className="ms-card">
            <span className="ms-name">Lifestyle Inflammation Score <small>GLIS</small></span>
            <p>A 0–100 read of that inflammation across inflammatory, metabolic and adiposity markers, with a confidence rating. The signal your MiAge is built on.</p>
          </div>
        </div>
      </div>
      <div className="miage-method reveal">
        <span className="mm-label">How MiAge is derived</span>
        <p>MiAge is a validated-method biological age from a routine, affordable blood test — no expensive DNA lab. Where your panel is complete, it’s anchored on the PhenoAge algorithm<sup><a href="#ref10">10</a>,<a href="#ref14">14</a></sup> and extended with cardiometabolic markers standard clocks leave out — insulin resistance, uric acid, adiposity.<sup><a href="#ref12">12</a>,<a href="#ref13">13</a></sup> Confidence rises with how complete your panel is. MiAge is in Beta — it runs on our v1 formulary while an independent clinical study is ongoing. A wellness indicator, not a diagnostic.</p>
      </div>
      <a className="measure-link reveal" href={DISEASE_FACTORY_URL} target="_blank" rel="noopener">See the mechanism behind your MiAge — the Disease Factory: how gut leakage drives inflammation and mitochondrial aging <ArrowRight size={15} /></a>
      <Trajectory note={<>Every re-test is a checkpoint you can see. Watching your own MiAge fall — a measurement, not a promise — is what carries people through all 90 days.</>} />
    </div></section>
  );
}

/* MiAge trajectory — one point per scan. Edit these to real numbers when available. */
const TRAJ = {
  calendarAge: 41,
  scans: [
    ["Day 0", 48, "Baseline"],
    ["Day 30", 46, ""],
    ["Day 60", 44, ""],
    ["Day 90", 42, "Re-test"],
  ],
};

/* interpolate hex colour a→b by t∈[0,1] — graduates the dots heat→recovery */
function lerpHex(a, b, t) {
  const ch = (h, i) => parseInt(h.slice(i, i + 2), 16);
  const mix = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${mix(ch(a, 1), ch(b, 1))}${mix(ch(a, 3), ch(b, 3))}${mix(ch(a, 5), ch(b, 5))}`;
}

function Trajectory({ note }) {
  const HEAT = "#FF5E3A", REC = "#2F86C9";
  const { calendarAge, scans } = TRAJ;
  const vals = scans.map((s) => s[1]);
  const yMax = Math.max(...vals, calendarAge) + 1;
  const yMin = Math.min(...vals, calendarAge) - 1;
  const xP = (i) => 5 + (i / (scans.length - 1)) * 90;
  const yP = (v) => 8 + ((yMax - v) / (yMax - yMin)) * 78;
  const pts = scans.map((s, i) => [xP(i), yP(s[1])]);
  const line = pts.map((p) => `${p[0]},${p[1]}`).join(" ");
  const area = "M " + pts.map((p) => `${p[0]},${p[1]}`).join(" L ") + ` L ${pts[pts.length - 1][0]},96 L ${pts[0][0]},96 Z`;
  const first = scans[0][1], last = scans[scans.length - 1][1];
  const calY = yP(calendarAge);
  return (
    <div className="traj reveal">
      <div className="traj-top">
        <span className="t">The 90-day trajectory</span>
        <span className="traj-lbi">↓ lower is better</span>
      </div>

      <div className="traj-delta">
        <div className="td-main"><b>−{first - last}</b><span>MiAge years<br />across the scans</span></div>
        <div className="td-flow">{first}<ArrowRight size={14} />{last}
          <small>The gap to your calendar age narrows from {first - calendarAge} to {last - calendarAge} years.</small>
        </div>
      </div>

      <div className="traj-plot">
        <svg className="traj-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="trajLine" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="0">
              <stop offset="0" stopColor={HEAT} /><stop offset="1" stopColor={REC} />
            </linearGradient>
            <linearGradient id="trajFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={HEAT} stopOpacity="0.16" /><stop offset="1" stopColor={REC} stopOpacity="0.015" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#trajFill)" />
          <line x1="0" y1={calY} x2="100" y2={calY} stroke="#8598AE" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" vectorEffect="non-scaling-stroke" />
          <polyline points={line} pathLength="1" fill="none" stroke="url(#trajLine)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>

        <span className="traj-cal" style={{ top: `${calY}%` }}>Calendar age {calendarAge}</span>

        {scans.map((s, i) => {
          const col = lerpHex(HEAT, REC, i / (scans.length - 1));
          const isLast = i === scans.length - 1;
          return (
            <div key={i} className={"traj-pt" + (isLast ? " last" : "")} style={{ left: `${pts[i][0]}%`, top: `${pts[i][1]}%` }}>
              <span className="tp-val" style={{ color: col }}>{s[1]}</span>
              <span className="tp-dot" style={{ borderColor: col, background: isLast ? col : "var(--slate-2)" }} />
            </div>
          );
        })}
      </div>

      <div className="traj-x">
        {scans.map((s, i) => {
          const isFirst = i === 0, isLast = i === scans.length - 1;
          return (
            <span key={i} style={{ left: `${pts[i][0]}%`, transform: `translateX(${isFirst ? "0" : isLast ? "-100%" : "-50%"})`, alignItems: isFirst ? "flex-start" : isLast ? "flex-end" : "center" }}>
              {s[0]}{s[2] && <small>{s[2]}</small>}
            </span>
          );
        })}
      </div>

      <p className="traj-ex">Illustrative example · individual results vary. Your real scans are tracked in the Gutguard app.</p>
      {note && <p className="traj-note">{note}</p>}
    </div>
  );
}

/* ───────────────────────── PAGES ───────────────────────── */

/* Story of Hope — a real, consented member replaces this before launch. Felt results only:
   no MiAge, GLIS or lab numbers in testimony while MiAge is in Beta. */
const STORY = {
  name: "[Member name]",
  realAge: "[age]",
  city: "[City]",
  months: 3,
  quoteShort: "[Their words, in one line]",
  quoteOpen: "[How they felt before starting, in their words]",
  felt: [
    ["Week 3", "[First change they noticed]", "Self-reported"],
    ["Week 6", "[Second change]", "Self-reported"],
    ["Week 9", "[The change they tell people about]", "Self-reported"],
  ],
  placeholder: true,
};

function StoryOfHope() {
  const s = STORY;
  return (
    <section className="section soh-section"><div className="wrap">
      <div className="soh reveal">
        <div className="soh-portrait">
          <span className="soh-eyebrow">Story of Hope</span>
          <div className="soh-photo" aria-label="Portrait placeholder"><span>Portrait</span></div>
          <p className="soh-q">“{s.quoteShort}”</p>
          <span className="soh-rule" />
          <div className="soh-name">{s.name}</div>
          <div className="soh-metar">Age <b>{s.realAge}</b> · {s.city}</div>
          {s.placeholder && <div className="soh-ph">Placeholder · a real, consented member is added before launch</div>}
        </div>
        <div className="soh-proof">
          <h3 className="soh-h">What they <em>felt.</em></h3>
          <div className="soh-tether">In their own words, over {s.months} months on the protocol</div>
          <p className="soh-long">&ldquo;{s.quoteOpen}&rdquo;</p>
          <div className="soh-felt">
            {s.felt.map(([wk, quote, sub]) => (
              <div className="soh-fr" key={wk}>
                <div className="soh-wk">{wk}</div>
                <div><p className="soh-ft">&ldquo;{quote}&rdquo;</p><div className="soh-fs">{sub}</div></div>
              </div>
            ))}
          </div>
          <p className="soh-caveat">These are self-reported experiences, not clinical outcomes, and individual results vary. Gutguard does not treat, cure or prevent any disease.</p>
        </div>
      </div>
    </div></section>
  );
}

/* Primary call to action — follows the visitor state */
function StartCTA({ anchor }) {
  const { who } = useVisitor();
  const m = isMember(who);
  const extra = anchor ? { "data-buyanchor": true } : {};
  return <a className="btn-primary" {...linkTo(m ? (who === "trial" ? "#/shop?tab=subscribe" : memberUrl("member", who)) : "#/shop?start=watch")} {...extra}>{m ? (who === "trial" ? "Continue your plan" : "Open my Lifestyle page") : "Start my 5 nights · ₱499"} <Arrow /></a>;
}

function Home() {
  const signals = [
    ["Cardiovascular", "Arterial damage, silently", "Chronic inflammation is a recognized driver of vascular damage — accumulating for years before a single symptom shows.", 5],
    ["Metabolic", "Insulin resistance", "A central force behind the metabolic decline that runs ahead of type 2 diabetes.", 6],
    ["Cognitive", "An aging brain", "“Inflammaging” is increasingly tied to memory and cognitive loss as the years compound.", 7],
  ];
  return (
    <>
      <header className="hero" id="top">
        <div className="wrap"><div className="hero-grid">
          <div className="hero-copy reveal">
            <span className="eyebrow">Science-backed · FDA-registered</span>
            <h1>Your body’s silently aging toward disease. <em>Take back control.</em></h1>
            <p className="hero-lede">Chronic inflammation drives that aging — silently, for years before symptoms. <strong>Now you can control it.</strong> A blood scan shows the 90-day protocol can bring it down. <strong>Progress you can see.</strong></p>
            <div className="hero-actions">
              <StartCTA />
              <a className="btn-ghost" href="#/system"><span className="ring"><ArrowRight size={13} /></span>See how it works</a>
            </div>
            <ul className="hero-proof reveal" aria-label="Why this is credible">
              <li>FDA-registered formula</li>
              <li>Research with MSU-IIT</li>
              <li>Physician-led clinical program</li>
              <li>20 branches nationwide</li>
            </ul>
          </div>
          <div className="hero-visual reveal">
            <div className="portrait" role="img" aria-label="A Gutguard member in warm daylight (graded photography placeholder)">
              <div className="grade" aria-hidden="true" /><div className="grain" aria-hidden="true" /><div className="vig" aria-hidden="true" />
              <span className="ph" aria-hidden="true">Portrait · warm duotone treatment</span>
            </div>
            <div className="bioscan reveal" aria-label="Example Blood Scan readout">
              <div className="bs-top"><span className="bs-label">Blood Scan</span><span className="bs-beta">Beta test</span></div>
              <div className="bs-reads">
                <div className="bs-read"><small>hs-CRP</small><span className="v">4.8</span></div>
                <div className="bs-read now"><small>Inflammation</small><span className="v"><CountUp to={62} /></span></div>
                <div className="bs-read"><small>Level</small><span className="v" style={{ fontSize: 20 }}>High</span></div>
              </div>
              <div className="bs-bars">
                <div className="bs-bar"><span className="k">Inflammation</span><div className="bs-track"><div className="bs-fill heat" style={{ "--w": "62%" }} aria-hidden="true" /></div></div>
                <div className="bs-bar"><span className="k">Restored</span><div className="bs-track"><div className="bs-fill rec" style={{ "--w": "38%" }} aria-hidden="true" /></div></div>
              </div>
              <span className="bs-sample">Sample readout · not yet live</span>
            </div>
          </div>
        </div></div>
      </header>

      <hr className="seam" />

      <section className="section" style={{ paddingBottom: 0 }}><div className="wrap">
        <TrialBand id="trial" />
      </div></section>

      <section className="section younger"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="why-now"><span className="num">01</span> Why now</div>
          <h2 className="sec">The body can age faster than the calendar — and it’s <em>starting younger.</em></h2>
          <p className="sec-sub">Ultra-processed food, chronic stress, and too little sleep drive chronic low-grade inflammation.<sup><a href="#ref1">1</a></sup> Once tied to later life, it now shows up in the 20s and 30s.</p>
        </div>
        <div className="stat-row reveal">
          <div className="stat"><span className="stat-n">20s–30s</span><span className="stat-l">when inflammation-driven wear now commonly begins</span></div>
          <div className="stat"><span className="stat-n">+10<small>yrs</small></span><span className="stat-l">how far biological age can run ahead of your real age</span></div>
          <div className="stat"><span className="stat-n">1 in 3</span><span className="stat-l">young adults already carrying early metabolic strain</span></div>
        </div>
        <p className="stat-note reveal">Illustrative figures — to be replaced with your verified, cited data.</p>
        <p className="sec-body reveal" style={{ marginTop: 28 }}>You can’t feel low-grade inflammation. You can measure it — and the earlier you do, the more time you have to act.</p>

        <figure className="review reveal">
          <div className="review-q">“I’m 23 and felt completely fine — my first number said otherwise. Three months in, watching it drop was proof I didn’t know I needed.”</div>
          <figcaption className="review-who">
            <div className="review-av" aria-hidden="true">—</div>
            <div><div className="review-nm">[Name], 23</div><div className="review-role">[City] · placeholder — drop in your real consented review</div></div>
          </figcaption>
        </figure>
      </div></section>

      <section className="section" style={{ background: "var(--paper)", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)" }}>
        <div className="wrap">
          <div className="reveal">
            <div className="sec-label" id="cost"><span className="num">02</span> The cost of not knowing</div>
            <h2 className="sec">What chronic inflammation does <em>before symptoms appear.</em></h2>
            <p className="sec-sub">Unmeasured, it builds for years — and it’s now linked to the leading causes of death and disability worldwide.<sup><a href="#ref1">1</a></sup></p>
            <p className="sec-body">Most people never measure it, so they learn of it only once a diagnosis names it.</p>
          </div>
          <p className="reveal" style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--heat-text)", marginTop: 48, marginBottom: 0 }}>Left unchecked, it’s linked to —</p>
          <div className="grid3 reveal" style={{ marginTop: 18 }}>
            {signals.map(([tag, h, b, r]) => (
              <div className="symptom" key={h}><div className="tag">{tag}</div><h3>{h}</h3><div className="b">{b}<sup><a href={"#ref" + r}>{r}</a></sup></div></div>
            ))}
          </div>
        </div>
      </section>

      <MeasureSection />
      <StoryOfHope />

      <section className="section"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="protocol"><span className="num">04</span> The protocol</div>
          <h2 className="sec">Three steps. Ninety days. <em>One</em> flagship.</h2>
          <p className="sec-sub">SynBIOTIC+ — the Gut-Mitochondrial Axis, powered.</p>
          <p className="sec-body" style={{ marginTop: 10 }}>Take it at <b>Reveille</b> (first thing in the morning, empty stomach) and at <b>Taps</b> (just before bedtime). Your dose follows your goal — see <a href="#/" onClick={(e) => { e.preventDefault(); const el = document.getElementById("dose"); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 116, behavior: "smooth" }); }} style={{ color: "var(--blue)", fontWeight: 600 }}>Find your dose</a>.</p>
        </div>
        <div className="proto-grid reveal">
          <div className="product" role="img" aria-label="SynBIOTIC+ (illustration)">
            <IllustCapsule className="prod-cap" />
            <div className="bottle">SynBIOTIC+</div>
            <div className="plus">Pre · Pro · Post Biotics</div>
            <div className="spec">80 Billion CFU · 17 strains · Urolithin-A + L-Tryptophan</div>
          </div>
          <div className="steps">
            {[["I", "Repair the gut environment", <>Pre-, pro- and postbiotics support the gut lining — including replenishing beneficial bacteria after a course of antibiotics<sup><a href="#ref8">8</a></sup> — where much of the body’s inflammatory signaling begins.</>],
              ["II", "Lower systemic inflammation", "As gut function improves, systemic inflammatory load can fall."],
              ["III", "Activate cellular renewal", <>The postbiotic Urolithin-A triggers mitophagy — the cell’s renewal of its mitochondria. In clinical trials, urolithin-A improved biomarkers of mitochondrial health in adults.<sup><a href="#ref3">3</a>,<a href="#ref4">4</a></sup></>]].map(([n, h, p]) => (
              <div className="step-row" key={n}><div className="step-n" aria-hidden="true">{n}</div><div className="step-tx"><h3>{h}</h3><p>{p}</p></div></div>
            ))}
          </div>
        </div>
      </div></section>


      <PhasesBlock />
      <DoseBlock num="05" />

      <TrustStrip />

      <section className="section"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="doors"><span className="num">06</span> Other doors</div>
          <h2 className="sec">Here for a different reason? <em>These doors open soon.</em></h2>
        </div>
        <div className="doors-soon reveal">
          <span className="soon-badge">Under construction</span>
          <h3>Pathways for physicians, partners, and organizations</h3>
          <p>Dedicated entry points are opening after launch — check back soon.</p>
        </div>
      </div></section>

      <section className="section refs"><div className="wrap">
        <div className="sec-label reveal" id="evidence">Evidence</div>
        <p className="ev-intro reveal"><b>The science this builds on.</b> The research below establishes what Gutguard measures — that chronic, low-grade inflammation is real, measurable, and drives how fast we age — and the rationale behind the protocol’s design.</p>
        <ol className="ref-list reveal">
          <li id="ref1">Kotas ME, Medzhitov R. Homeostasis, inflammation, and disease susceptibility. <i>Cell</i>. 2015;160(5):816–827. doi:10.1016/j.cell.2015.02.010</li>
          <li id="ref2">Franceschi C, Bonafè M, Valensin S, et al. Inflamm-aging: an evolutionary perspective on immunosenescence. <i>Annals of the New York Academy of Sciences</i>. 2000;908:244–254. doi:10.1111/j.1749-6632.2000.tb06651.x</li>
          <li id="ref3">Singh A, D’Amico D, Andreux PA, et al. Urolithin A improves muscle strength, exercise performance, and biomarkers of mitochondrial health in a randomized trial in middle-aged adults. <i>Cell Reports Medicine</i>. 2022;3(5):100633. doi:10.1016/j.xcrm.2022.100633</li>
          <li id="ref4">Liu S, D’Amico D, Shankland E, et al. Effect of urolithin A supplementation on muscle endurance and mitochondrial health in older adults: a randomized clinical trial. <i>JAMA Network Open</i>. 2022;5(1):e2144279. doi:10.1001/jamanetworkopen.2021.44279</li>
          <li id="ref5">Ridker PM, Everett BM, Thuren T, et al.; CANTOS Trial Group. Antiinflammatory therapy with canakinumab for atherosclerotic disease. <i>New England Journal of Medicine</i>. 2017;377(12):1119–1131. doi:10.1056/NEJMoa1707914</li>
          <li id="ref6">Pradhan AD, Manson JE, Rifai N, Buring JE, Ridker PM. C-reactive protein, interleukin 6, and risk of developing type 2 diabetes mellitus. <i>JAMA</i>. 2001;286(3):327–334. doi:10.1001/jama.286.3.327</li>
          <li id="ref7">Walker KA, Gottesman RF, Wu A, et al. Systemic inflammation during midlife and cognitive change over 20 years: the ARIC Study. <i>Neurology</i>. 2019;92(11):e1256–e1267. doi:10.1212/WNL.0000000000007094</li>
          <li id="ref8">Hempel S, Newberry SJ, Maher AR, et al. Probiotics for the prevention and treatment of antibiotic-associated diarrhea: a systematic review and meta-analysis. <i>JAMA</i>. 2012;307(18):1959–1969. doi:10.1001/jama.2012.3507</li>
          <li id="ref9">Li Y, Berliocchi L, Li Z, Rasmussen LJ. Interactions between mitochondrial dysfunction and other hallmarks of aging: paving a path toward interventions that promote healthy old age. <i>Aging Cell</i>. 2024;23(1):e13942. doi:10.1111/acel.13942</li>
          <li id="ref10">Levine ME, Lu AT, Quach A, et al. An epigenetic biomarker of aging for lifespan and healthspan. <i>Aging (Albany NY)</i>. 2018;10(4):573–591. doi:10.18632/aging.101414</li>
          <li id="ref11">López-Otín C, Blasco MA, Partridge L, Serrano M, Kroemer G. The hallmarks of aging. <i>Cell</i>. 2013;153(6):1194–1217. doi:10.1016/j.cell.2013.05.039</li>
          <li id="ref12">Kresovich JK, Garval EL, Martinez Lopez AM, et al. Associations of body composition and physical activity level with multiple measures of epigenetic age acceleration. <i>American Journal of Epidemiology</i>. 2021;190(6):984–993. doi:10.1093/aje/kwaa251</li>
          <li id="ref13">Tucker LA. Insulin resistance and biological aging: the role of body mass, waist circumference, and inflammation. <i>BioMed Research International</i>. 2022;2022:2146596. doi:10.1155/2022/2146596</li>
          <li id="ref14">Liu Z, Kuo P-L, Horvath S, Crimmins E, Ferrucci L, Levine M. A new aging measure captures morbidity and mortality risk across diverse subpopulations from NHANES IV: a cohort study. <i>PLoS Medicine</i>. 2018;15(12):e1002718. doi:10.1371/journal.pmed.1002718</li>
        </ol>

        <div className="sec-label reveal" style={{ marginTop: 46 }}>Our own evidence</div>
        <p className="ev-intro reveal">The studies above establish the problem. The evidence below is how we show what Gutguard does about it — our population, our protocol, speaking to the product directly. It’s being built now.</p>
        <ul className="own-ev reveal">
          <li>
            <span className="ev-status">Study in progress</span>
            <h4>Autism spectrum clinical study</h4>
            <p>A joint research study and partnership with Beehive Brain Developmental Center, in collaboration with MSU-IIT as the research institution — a 12-week protocol evaluating change in inflammatory and gut-axis markers. <span className="ev-ph">[Add the public trial-registration ID and published results here once available.]</span></p>
          </li>
          <li>
            <span className="ev-status">Pilot underway</span>
            <h4>Lead Clinical Adopter outcomes</h4>
            <p>Before-and-after inflammation readings from patients on the protocol under physician supervision. <span className="ev-ph">[Add aggregate pilot outcomes and physician count here once collected.]</span></p>
          </li>
        </ul>
        <p className="ref-note reveal">Entries above describe evidence Gutguard is generating; bracketed items are placeholders to be completed with real data before publication. Nothing here is a therapeutic claim.</p>
      </div></section>

      <FinalCTA />
      <Compliance />
    </>
  );
}

function Science() {
  return (
    <>
      <header className="hero">
        <div className="wrap"><div className="narrow reveal" style={{ maxWidth: 760 }}>
          <span className="eyebrow">The Science</span>
          <h1>The science, <em>in plain sight.</em></h1>
          <p className="hero-lede">No black box. Here is exactly how inflammation compounds into the way you feel — and how the right repair runs it in reverse.</p>
          <div className="hero-actions"><StartCTA /></div>
        </div></div>
      </header>

      <hr className="seam" />

      <section className="section"><div className="wrap">
        <div className="reveal" style={{ marginBottom: 8 }}>
          <div className="sec-label" id="mechanism"><span className="num">01</span> The mechanism</div>
          <h2 className="sec">How a leaky gut quietly becomes a <em>tired body.</em></h2>
          <p className="sec-body" style={{ marginTop: 14 }}>When the gut barrier weakens, bacterial fragments leak into the bloodstream. The immune system reacts, inflammation spreads body-wide, and it wears down the mitochondria that power your cells — which fuels still more inflammation.<sup><a href="#mref1">1</a>,<a href="#mref2">2</a>,<a href="#mref3">3</a></sup> This is what your MiAge measures; the Disease Factory below walks it stage by stage.</p>
        </div>
        <div className="teaser reveal">
          <a className="teaser-art" href={DISEASE_FACTORY_URL} target="_blank" rel="noopener" aria-label="Open the Disease Factory interactive explainer (opens in a new tab)"><span className="teaser-play" aria-hidden="true"><Play size={30} fill="currentColor" /></span></a>
          <div className="teaser-body">
            <h3>The Disease Factory</h3>
            <p>Walk the nine stages: how gut leakage compounds into inflammation and mitochondrial aging — the very process your MiAge measures — and how the protocol runs it in reverse. An interactive explainer on its own page.</p>
            <a className="btn-ghost" href={DISEASE_FACTORY_URL} target="_blank" rel="noopener"><span className="ring"><ArrowRight size={13} /></span>Enter the Disease Factory</a>
          </div>
        </div>
        <ol className="ref-list reveal" style={{ marginTop: 26 }}>
          <li id="mref1">Camilleri M. Leaky gut: mechanisms, measurement and clinical implications in humans. <i>Gut</i>. 2019;68(8):1516–1526. doi:10.1136/gutjnl-2019-318427</li>
          <li id="mref2">Fasano A. All disease begins in the (leaky) gut: role of zonulin-mediated gut permeability in the pathogenesis of some chronic inflammatory diseases. <i>F1000Research</i>. 2020;9:69. doi:10.12688/f1000research.20510.1</li>
          <li id="mref3">Li Y, Berliocchi L, Li Z, Rasmussen LJ. Interactions between mitochondrial dysfunction and other hallmarks of aging: paving a path toward interventions that promote healthy old age. <i>Aging Cell</i>. 2024;23(1):e13942. doi:10.1111/acel.13942</li>
        </ol>
      </div></section>

      <section className="section"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="triggers"><span className="num">02</span> The triggers</div>
          <h2 className="sec">Modern life keeps the fire <em>lit.</em></h2>
          <p className="sec-sub">Everyday pressures — especially here — that quietly feed chronic inflammation.</p>
          <p className="sec-body">Your biology hasn’t changed in millennia; your environment has. These are the forces measurably pushing inflammation up, day after day.</p>
        </div>
        <div className="triggers reveal">
          {TRIGGERS.map(([n, h, stat, ctx, imp], i) => (
            <div className="trigger" key={n}>
              <div className="tnum">{n}</div>
              <h3>{h}</h3>
              <div className="tstat">{stat}<sup><a href={"#tref" + (i + 1)}>{i + 1}</a></sup></div>
              <div className="ctx">{ctx}</div>
              <div className="impact">{imp}</div>
            </div>
          ))}
        </div>
        <ol className="ref-list reveal" style={{ marginTop: 32 }}>
          <li id="tref1">Lane MM, Gamage E, Du S, et al. Ultra-processed food exposure and adverse health outcomes: umbrella review of epidemiological meta-analyses. <i>BMJ</i>. 2024;384:e077310. doi:10.1136/bmj-2023-077310</li>
          <li id="tref2">Rosengren A, Hawken S, Ôunpuu S, et al. Association of psychosocial risk factors with risk of acute myocardial infarction in 11 119 cases and 13 648 controls from 52 countries (the INTERHEART study): case-control study. <i>The Lancet</i>. 2004;364(9438):953–962. doi:10.1016/S0140-6736(04)17019-0</li>
          <li id="tref3">Cappuccio FP, Cooper D, D’Elia L, Strazzullo P, Miller MA. Sleep duration predicts cardiovascular outcomes: a systematic review and meta-analysis of prospective studies. <i>European Heart Journal</i>. 2011;32(12):1484–1492. doi:10.1093/eurheartj/ehr007</li>
          <li id="tref4">Ekelund U, Steene-Johannessen J, Brown WJ, et al. Does physical activity attenuate the association of sitting time with mortality? A harmonised meta-analysis of data from more than 1 million men and women. <i>The Lancet</i>. 2016;388(10051):1302–1310. doi:10.1016/S0140-6736(16)30370-1</li>
          <li id="tref5">World Health Organization. Billions of people still breathe unhealthy air: new WHO data. Geneva: WHO; 2022.</li>
          <li id="tref6">Palleja A, Mikkelsen KH, Forslund SK, et al. Recovery of gut microbiota of healthy adults following antibiotic exposure. <i>Nature Microbiology</i>. 2018;3(11):1255–1265. doi:10.1038/s41564-018-0257-9</li>
        </ol>
      </div></section>

      <section className="section" style={{ background: "var(--paper)", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)" }}><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="measure"><span className="num">03</span> How we measure</div>
          <h2 className="sec">Belief needs <em>proof.</em> Proof needs a method.</h2>
          <p className="sec-body">Understanding the biology is only half of it. The other half is measuring it — repeatably, from routine lab markers, the same way every time.</p>
          <div className="hero-actions" style={{ marginTop: 24 }}>
            <a className="btn-primary" href="#/system">See the measurement system <Arrow /></a>
          </div>
        </div>
      </div></section>

      <section className="section"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="standard"><span className="num">04</span> The standard we hold</div>
          <h2 className="sec">Filipino-authored, <em>global-standard</em> science.</h2>
          <p className="sec-body">Built with MERAV and MSU-IIT, registered with the FDA, and supported by USAID — the measurement stack uses routine, accessible lab markers so the science stays grounded and repeatable.</p>
        </div>
      </div></section>

      <TrustStrip />
      <Compliance />
    </>
  );
}

/* Shop — the SynBIOTIC+ Shoplet (gutguard-shoplet, CSA's original design): one screen, buy bar, basket sheet.
   Changed only: Addendum 01 products and prices, the 5-Night Watch in "Try first", a "Subscribe" tab (Gutguard Daily),
   and checkout hands off to the Lifestyle landing (guests) or the Lifestyle page (members). The website takes no payment. */
const SL_RECOMMENDED = "peak";
const SL_TIERS = [
  { id: "start", name: "Start", phase: "15-day", days: 15, caps: 30, perCap: 133, price: 3999 },
  { id: "grow", name: "Grow", phase: "45-day", days: 45, caps: 90, perCap: 122, price: 10999, tag: "Popular" },
  { id: "peak", name: "Peak", phase: "90-day", days: 90, caps: 330, perCap: 89, price: 29369, tag: "Best rate" },
];
const SL_TRIALS = [
  { id: "watch", name: "5-Night Watch", caps: 10, price: 499, first: true }, /* first order only, guests */
  { id: "blister", name: "Blister", caps: 10, price: 1499 },
  { id: "bottle", name: "Bottle", caps: 30, price: 3799 },
];
const PROOF = [["FDA", "Registered"], ["MSU-IIT", "Co-developed"], ["USAID", "Funded science"], ["LactoSpore®", "Spore probiotic"]];
const SCIENCE = [
  ["Probiotics — survive & seat", "Stable LactoSpore® (Bacillus coagulans) plus nanoshell-coated Lactobacillus and Bifidobacterium strains, chosen for gut barrier, immunity and the gut-brain axis."],
  ["Prebiotics — feed & colonize", "Patented FOS + Inulin feed the beneficial colon bacteria so the strains take hold."],
  ["Postbiotics — signal & renew", "Metabolic signaling molecules — Urolithin-A and L-Tryptophan — carry the benefit through to the cell."],
];
const FACTS = {
  serving: "1 capsule (600 mg)",
  actives: [
    ["L-Tryptophan", "100 mg"],
    ["Urolithin-A", "10 mg"],
    ["Glutathione", "250 mg"],
    ["Lutein", "250 mg"],
  ],
  macros: "Calories 0 · Total Fat 0 · Cholesterol 0 · Sodium 0 · Total Carbohydrate 0 · Sugar 0 · Protein 0",
  footnote: "** % RENI not established for these actives. % values based on PDRI 2015 (adult male, 19–29 yrs).",
};
const Bottle = ({ s = 60 }) => (
  <svg width={s} height={s * 170 / 140} viewBox="0 0 140 170" fill="none" aria-hidden="true">
    <ellipse cx="70" cy="161" rx="41" ry="7" fill="#141019" opacity="0.08" />
    <rect x="34" y="40" width="72" height="121" rx="19" fill="url(#b1)" stroke="#D8D2C2" />
    <rect x="47" y="20" width="46" height="26" rx="8" fill="#141019" /><rect x="52" y="13" width="36" height="11" rx="5" fill="#141019" />
    <rect x="34.5" y="75" width="71" height="60" rx="3" fill="#FCFAF5" /><rect x="34.5" y="75" width="71" height="6" fill="url(#b2)" />
    <rect x="47" y="92" width="46" height="7" rx="3.5" fill="#141019" opacity="0.9" /><rect x="47" y="106" width="32" height="4" rx="2" fill="#6B6B7A" /><rect x="47" y="114" width="40" height="4" rx="2" fill="#6B6B7A" /><rect x="47" y="124" width="17" height="7.5" rx="3.75" fill="url(#b2)" />
    <defs><linearGradient id="b1" x1="0" y1="40" x2="0" y2="161" gradientUnits="userSpaceOnUse"><stop stopColor="#FCFAF5" /><stop offset="1" stopColor="#EBE4D7" /></linearGradient><linearGradient id="b2" x1="34" y1="0" x2="106" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="#B5431F" /><stop offset="1" stopColor="#1E6FB8" /></linearGradient></defs>
  </svg>
);
const Ico = {
  basket: (s = 21) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 11h14l-1 9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" /><path d="M9 11 12 4l3 7" /><line x1="3" y1="11" x2="21" y2="11" /></svg>),
  check: (s = 16) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>),
  lock: (s = 13) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>),
  shield: (s = 13) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>),
  pulse: (s = 13) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>),
  x: (s = 22) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>),
  arrow: (s = 18) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>),
  back: (s = 20) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>),
  info: (s = 13) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>),
};


const ORDER_SHIP = 150; /* PLACEHOLDER flat shipping for one-time items — same value as the Lifestyle Page. CSA to confirm */
const SAME_SITE = false; /* production: true — links open in the same tab (same domain). Demo: the pages are separate artifacts */
function useWideShop() {
  const q = "(min-width: 900px)";
  const [w, setW] = useState(() => typeof window !== "undefined" && window.matchMedia && window.matchMedia(q).matches);
  useEffect(() => { const m = window.matchMedia(q); const f = () => setW(m.matches); f(); m.addEventListener ? m.addEventListener("change", f) : m.addListener(f); return () => (m.removeEventListener ? m.removeEventListener("change", f) : m.removeListener(f)); }, []);
  return w;
}
/* ───────── Option C: buy on the website, use in the Lifestyle Page ─────────
   Shop → Basket → Checkout (one sheet) → Done. The free Lifestyle card is made from the checkout details. */
const DELIVERY_DAYS = { M: "2–4", V: "3–5", L: "3–6" }; /* PLACEHOLDER courier times by island group — CSA to confirm */
const etaFor = (province) => { const p = CITIES.find((x) => x[0] === province); return p ? `Arrives in ${DELIVERY_DAYS[p[1]]} working days` : "Arrives in 2–6 working days, depending on where you are"; };
/* one search field for the city; the province fills itself */
const CITY_INDEX = CITIES.flatMap((p) => p[2].map((c) => ({ city: c, province: p[0], key: c.toLowerCase().replace(/^city of /, "") })));
const findCities = (q) => {
  const t = q.trim().toLowerCase().replace(/^city of /, ""); if (t.length < 2) return [];
  const out = [];
  CITY_INDEX.forEach((c) => {
    const words = c.key.split(/[\s(.]+/);
    const rank = c.key.startsWith(t) ? 0 : words.some((w) => w.startsWith(t)) ? 2 : (c.key + " " + c.province.toLowerCase()).includes(t) ? 4 : -1;
    if (rank >= 0) out.push([rank + (/ city$/i.test(c.city) ? 0 : 1), c]); /* cities before towns */
  });
  return out.sort((x, y) => x[0] - y[0] || x[1].city.localeCompare(y[1].city)).slice(0, 5).map((x) => x[1]); /* 5 fit above the phone keyboard */
};
const PTS = { watch: 1, blister: 1, bottle: 3, start: 3, grow: 9, peak: 33 };
const TRIAL_CREDIT = 499;
/* Savings: one base for everything — the Blister, ₱1,499 for 10 capsules (₱149.90 per capsule). Rounded DOWN. The 5-Night Watch has no tag (it is a trial). */
const BASE_CAP = 149.9;
const pctOff = (price, caps) => Math.max(0, Math.floor((1 - price / (caps * BASE_CAP)) * 100));
const capsOf = (it) => (it.kind === "daily" ? GOALS.find((q) => q.id === it.goal).mo * 10 : ((SL_TIERS.find((t) => t.id === it.id) || SL_TRIALS.find((t) => t.id === it.id) || {}).caps || 0));
const savedOn = (it) => (it.kind === "watch" ? 0 : Math.max(0, Math.round(capsOf(it) * BASE_CAP - it.price)) * it.qty);
const TRIAL_DOSE = [["Night 1", "1 capsule at Taps"], ["Days 2 to 5", "1 at Reveille, 1 at Taps"], ["Day 6", "Your last capsule, at Reveille"]];
const ME_DEMO = { name: "Rey Aquino", mobile: "0917 111 2233", province: "South Cotabato", city: "General Santos City", brgy: "Lagao", street: "12 Rizal St." };
const PAYS = [["card", "Card", "Visa or Mastercard"], ["gcash", "GCash", "We open GCash to pay"], ["maya", "Maya", "Pay with your Maya wallet"], ["cod", "Cash on Delivery", "Pay in cash when it arrives"], ["install", "Instalments", "3 or 6 months · Peak only"]];
const FAIL_TEXT = { card: "Your card was declined.", gcash: "The GCash payment was cancelled or timed out.", maya: "The Maya payment did not go through.", install: "The instalment application was not approved." };
const fmtMobile = (v) => { const d = v.replace(/\D/g, "").slice(0, 11); return [d.slice(0, 4), d.slice(4, 7), d.slice(7, 11)].filter(Boolean).join(" "); };
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-PH", { day: "numeric", month: "short" }); };
const firstName = (n) => (n.trim().split(/\s+/)[0] || "");
const stageFor = (who) => (who === "trial" ? "ordered" : who === "card" ? "card" : "member");

function Shop({ params = {} }) {
  const { who, setWho, failNext, setFailNext, usedBefore } = useVisitor();
  const member = isMember(who);
  const [numberUsed, setNumberUsed] = useState(false); /* the verified mobile has ordered before (server check) */
  const firstOrder = (who === "guest" || who === "card") && !numberUsed; /* the 5-Night Watch is for a first order only: one per mobile number */
  const wide = useWideShop();
  const trials = SL_TRIALS.filter((t) => !(t.first && !firstOrder));
  const [mode, setMode] = useState("trial");
  const [sel, setSel] = useState(SL_RECOMMENDED);
  const [trialSel, setTrialSel] = useState(firstOrder ? "watch" : "blister");
  const [goal, setGoal] = useState("better");
  const [basket, setBasket] = useState(() => { try { const b = JSON.parse(localStorage.getItem("gg-shop-basket") || "[]"); return Array.isArray(b) ? b : []; } catch (e) { return []; } });
  useEffect(() => { try { localStorage.setItem("gg-shop-basket", JSON.stringify(basket)); } catch (e) {} }, [basket]);
  const [conflict, setConflict] = useState(null);
  const [stage, setStage] = useState("shop"); // shop | cart | checkout | done
  const [info, setInfo] = useState("");
  /* checkout */
  const blank = { mobile: "", name: "", province: "", city: "", brgy: "", street: "" };
  const [form, setForm] = useState(member ? ME_DEMO : blank);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(member);
  const [editAddr, setEditAddr] = useState(!member);
  const [pay, setPay] = useState("card");
  const [months, setMonths] = useState(3);
  const [subAgree, setSubAgree] = useState(false);
  const [refOpen, setRefOpen] = useState(false);
  const [refCode, setRefCode] = useState("");
  const [paying, setPaying] = useState(false);
  const [payFail, setPayFail] = useState(null);
  const [tried, setTried] = useState(false);
  const [order, setOrder] = useState(null);
  const [smsOk, setSmsOk] = useState(false);
  const [cityQ, setCityQ] = useState("");
  const sheetRef = useRef(null);
  useEffect(() => { if (member) { setForm((f) => (f.name ? f : ME_DEMO)); setVerified(true); setEditAddr(false); } }, [member]);
  useEffect(() => { if (!firstOrder) { setTrialSel((t) => (t === "watch" ? "blister" : t)); setBasket((b) => b.filter((x) => x.kind !== "watch")); } }, [firstOrder]);
  /* First-order check: when a guest verifies the mobile number, the server looks it up. If that number has used a 5-Night Watch
     before, or has any order in the last 12 months, the Watch becomes a Blister and the Watch is hidden. Demo: DEMO chip "Mobile ordered before". */
  const [swapNote, setSwapNote] = useState(false);
  /* Buying for someone else: one plan per person who takes the capsules; one payer can pay for many people.
     The other person gets their own free card by SMS and joins under the payer. E-Points go to the payer. */
  const [forOther, setForOther] = useState(false);
  const [rcp, setRcp] = useState({ name: "", mobile: "" });
  const [myAddr, setMyAddr] = useState(null);
  const rcpDigits = rcp.mobile.replace(/\D/g, "").length;
  const pickFor = (other) => {
    if (other === forOther) return;
    if (other) { setMyAddr({ province: form.province, city: form.city, brgy: form.brgy, street: form.street }); setForm((f) => ({ ...f, province: "", city: "", brgy: "", street: "" })); setEditAddr(true); }
    else { if (myAddr) setForm((f) => ({ ...f, ...myAddr })); setEditAddr(!(myAddr && myAddr.street)); }
    setForOther(other); setCityQ("");
  };
  useEffect(() => {
    /* the Watch rule checks the number of the person who takes it */
    if (forOther) { if (rcpDigits !== 11 || !usedBefore || numberUsed) return; }
    else if (!verified || member || !usedBefore || numberUsed) return;
    setNumberUsed(true);
    setBasket((b) => { if (!b.some((x) => x.kind === "watch")) return b; setSwapNote(true); const bl = SL_TRIALS.find((t) => t.id === "blister"); return put(b.filter((x) => x.kind !== "watch"), { id: "blister", kind: "once", name: "SynBIOTIC+ · Blister", sub: bl.caps + " caps · " + peso(bl.price) + " each", price: bl.price }); });
  }, [verified, usedBefore, member, numberUsed, forOther, rcpDigits]);

  /* links from the nav, the footer offer and the Lifestyle Page: ?start=watch · ?tab=subscribe&goal=better · ?tab=protocol */
  useEffect(() => {
    if (params.tab === "subscribe") { setMode("subscribe"); if (GOALS.find((g) => g.id === params.goal)) setGoal(params.goal); }
    else if (params.tab === "protocol") setMode("protocol");
    if (params.start === "watch" && firstOrder) { setMode("trial"); setTrialSel("watch"); setBasket([{ id: "watch", kind: "watch", name: "5-Night Watch", sub: "10 caps · 5 nights · new buyers", price: 499, qty: 1 }]); setStage("checkout"); }
  }, [params._k]);
  /* SMS code fills itself on Android (Web OTP). The SMS must end with: @gutguard.ph #123456 */
  useEffect(() => {
    if (!codeSent || verified || typeof window === "undefined" || !("OTPCredential" in window)) return;
    const ac = new AbortController();
    navigator.credentials.get({ otp: { transport: ["sms"] }, signal: ac.signal }).then((o) => { if (o && o.code) { setCode(o.code.slice(0, 6)); setVerified(true); focusNext("co-n"); } }).catch(() => {});
    return () => ac.abort();
  }, [codeSent, verified]);

  const pt = SL_TIERS.find((t) => t.id === sel);
  const trial = trials.find((t) => t.id === trialSel) || trials[0];
  const g = GOALS.find((x) => x.id === goal);
  const link = SAME_SITE ? {} : { target: "_blank", rel: "noopener" };

  const itemFor = () => {
    if (mode === "trial" && trial.first) return { id: "watch", kind: "watch", name: "5-Night Watch", sub: "10 caps · 5 nights · new buyers", price: trial.price };
    if (mode === "trial") return { id: trial.id, kind: "once", name: "SynBIOTIC+ · " + trial.name, sub: trial.caps + " caps · " + peso(trial.price) + " each", price: trial.price };
    if (mode === "protocol") return { id: pt.id, kind: "once", name: "SynBIOTIC+ · " + pt.name, sub: pt.caps + " caps · " + (pt.id === "peak" ? "90-Day Protocol" : peso(pt.price) + " each"), price: pt.price };
    return { id: "daily", kind: "daily", goal, name: "Gutguard Daily · " + g.goal, sub: g.perDay + " a day · " + g.mo + " blisters a month", price: g.mo * MONTHLY };
  };
  /* The Watch and the plan are one per order: when the one on screen is already in, the buy button says so */
  const inOrder = (mode === "trial" && trial.first && basket.some((x) => x.kind === "watch")) || (mode === "subscribe" && basket.some((x) => x.kind === "daily" && x.goal === goal));
  const put = (b, item) => {
    if (item.kind === "watch") return b.some((x) => x.kind === "watch") ? b : [...b, { ...item, qty: 1 }]; /* one Watch per order; it can share the box with one-time items */
    if (item.kind === "daily") return [...b.filter((x) => x.kind !== "daily"), { ...item, qty: 1 }];
    const e = b.find((x) => x.id === item.id);
    return e ? b.map((x) => (x.id === item.id ? { ...x, qty: Math.min(x.qty + 1, 20) } : x)) : [...b, { ...item, qty: 1 }];
  };
  const onBuy = () => {
    if (inOrder) { setStage("checkout"); return; } /* this exact item is already in the order: just go back */
    const item = itemFor();
    /* Only one pair clashes: the Watch (a trial before a plan) and Gutguard Daily (the plan itself) */
    const hasWatch = basket.some((x) => x.kind === "watch"), hasDaily = basket.some((x) => x.kind === "daily");
    if ((item.kind === "watch" && hasDaily) || (item.kind === "daily" && hasWatch)) setConflict(item);
    else { setConflict(null); setBasket((b) => put(b, item)); }
    setStage("checkout"); setTimeout(() => { if (sheetRef.current) sheetRef.current.scrollTop = 0; }, 0);
  };
  const keepWatch = () => { setBasket((b) => put(b.filter((x) => x.kind !== "daily"), conflict.kind === "watch" ? conflict : b.find((x) => x.kind === "watch"))); setConflict(null); };
  const keepPlan = () => { setBasket((b) => put(b.filter((x) => x.kind !== "watch"), conflict.kind === "daily" ? conflict : b.find((x) => x.kind === "daily"))); setConflict(null); };
  const setLineQty = (id, q) => setBasket((b) => (q <= 0 ? b.filter((x) => x.id !== id) : b.map((x) => (x.id === id ? { ...x, qty: Math.min(q, 20) } : x))));

  const basketCount = basket.reduce((s, x) => s + x.qty, 0);
  const hasOnce = basket.some((x) => x.kind === "once");
  const daily = basket.find((x) => x.kind === "daily");
  const hasWatch = basket.some((x) => x.kind === "watch");
  const isWatch = basket.length === 1 && hasWatch; /* the Watch alone: free shipping */
  const hasPeak = basket.some((x) => x.id === "peak");
  const ship = hasOnce ? ORDER_SHIP : 0;
  const itemsTotal = basket.reduce((s, x) => s + x.price * x.qty, 0);
  const credit = daily && who === "trial" && !forOther ? TRIAL_CREDIT : 0; /* the trial credit is for the trial member's own plan */
  const totalToday = itemsTotal + ship - credit;
  const saved = basket.reduce((s, x) => s + savedOn(x), 0);
  const pts = basket.reduce((s, x) => s + (x.kind === "daily" ? GOALS.find((q) => q.id === x.goal).mo : (PTS[x.id] || 0) * x.qty), 0);
  const allowCOD = basket.length > 0 && !daily && !hasWatch && !forOther; /* no COD with a ₱499 trial in the order, or when it goes to someone else */
  const allowInstall = allowCOD && hasPeak;
  const payOptions = PAYS.filter(([k]) => (k === "cod" ? allowCOD : k === "install" ? allowInstall : true));
  const payKey = payOptions.some(([k]) => k === pay) ? pay : "card";
  const perMonth = Math.ceil(totalToday / months);
  const addrOk = !!(form.street.trim() && form.brgy && form.city && form.province);
  const hasPlanNow = who === "sub"; /* demo: this member already has Gutguard Daily */
  const planForMe = daily && hasPlanNow && !forOther; /* a second plan for the same person is not allowed */
  const rcpOk = !forOther || (rcp.name.trim().length > 1 && rcpDigits === 11 && rcp.mobile.replace(/\D/g, "") !== form.mobile.replace(/\D/g, ""));
  const contactOk = verified && form.name.trim().length > 1 && rcpOk && !planForMe;
  const canPay = basket.length > 0 && contactOk && addrOk && (!daily || subAgree);
  const shipText = mode === "subscribe" ? "Free delivery" : mode === "trial" && trial.first ? "Free shipping" : "Shipping " + peso(ORDER_SHIP);
  const bar = inOrder ? <>In your order · Back to checkout</>
    : mode === "trial" && trial.first ? <>Start my 5 nights<span className="p">· {peso(trial.price)}</span></>
    : mode === "trial" ? <>Try it first<span className="p">· {peso(trial.price)}</span></>
    : mode === "protocol" ? <>Begin {pt.name}<span className="p">· {peso(pt.price)}</span></>
    : <>Subscribe<span className="p">· {peso(g.mo * MONTHLY)}/mo</span></>;
  const payLabel = paying ? (payKey === "cod" ? "Placing order…" : "Confirming payment…")
    : payKey === "cod" ? <>Place order · pay on delivery</>
    : payKey === "install" ? <>Continue · {peso(perMonth)}/mo × {months}</>
    : payKey === "gcash" ? <>Pay {peso(totalToday)} with GCash</>
    : payKey === "maya" ? <>Pay {peso(totalToday)} with Maya</> : <>Pay {peso(totalToday)}</>;
  const close = () => { setStage("shop"); setConflict(null); };
  /* "+ Add more items": back to the Shop on something that can still be added (not the Watch or the plan already in the order) */
  const addMore = () => {
    close();
    if (mode === "trial" && basket.some((x) => x.kind === "watch")) setTrialSel((packs[0] || {}).id || "blister");
    if (mode === "subscribe" && basket.some((x) => x.kind === "daily")) setMode("protocol");
  };
  const sheetOpen = stage !== "shop" || info !== "";
  const toTop = () => { if (sheetRef.current) sheetRef.current.scrollTop = 0; };

  const sendCode = () => { if (form.mobile.replace(/\D/g, "").length === 11) { setCodeSent(true); setCode(""); } };
  const afterVerify = () => focusNext(!form.name.trim() ? "co-n" : forOther ? "co-rn" : "co-cityq");
  const typeCode = (v) => { const c = v.replace(/\D/g, "").slice(0, 6); setCode(c); if (c.length === 6) { setVerified(true); afterVerify(); } /* demo: any 6 digits */ };
  const tryPay = () => {
    setTried(true);
    if (!canPay || paying) {
      const id = !basket.length ? "co-items" : planForMe ? "co-for" : !verified ? "co-mobile" : form.name.trim().length < 2 ? "co-name" : !rcpOk ? "co-rcp" : !addrOk ? "co-addr" : "co-agree";
      /* take the buyer straight to the first missing field */
      const field = !basket.length || planForMe ? null : !verified ? (codeSent ? "co-code" : "co-m") : form.name.trim().length < 2 ? "co-n" : !rcpOk ? (rcp.name.trim().length < 2 ? "co-rn" : "co-rm") : !addrOk ? (!form.city ? "co-cityq" : !form.brgy ? "co-brgy" : "co-st") : null;
      if (field && document.getElementById(field)) { focusNext(field); return; }
      const el = document.getElementById(id); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); const f = /^(INPUT|SELECT)$/.test(el.tagName) ? el : el.querySelector("input:not([type=checkbox]):not([disabled]), select:not([disabled])"); if (f && !f.value) setTimeout(() => { try { f.focus({ preventScroll: true }); } catch (e) {} }, 350); }
      return;
    }
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      if (failNext && payKey !== "cod") { setFailNext(false); setPayFail(payKey); toTop(); return; }
      const newMember = who === "guest"; /* the payer gets a card too: the E-Points go there */
      /* Gut Guardian: earned by finishing the 5-Night Watch, or by starting with any pack or plan */
      const becameGuardian = !forOther && !hasWatch && (who === "guest" || who === "card" || who === "trial");
      const doseGoal = daily ? daily.goal : hasPeak ? "full" : "keep";
      setOrder({ lines: basket, pts, total: totalToday, pay: payKey, months, isWatch: hasWatch, withOthers: hasWatch && basket.length > 1, daily, peak: hasPeak, newMember, name: form.name, province: form.province, doseGoal, credit, ref: refCode.trim(), forOther, rcpName: rcp.name.trim(), becameGuardian });
      setBasket([]); setPayFail(null); setTried(false); setStage("done"); toTop();
      if (forOther) { setWho(who === "guest" ? "card" : who); pickFor(false); setRcp({ name: "", mobile: "" }); }
      else setWho(hasWatch ? "trial" : daily ? "sub" : hasPeak ? "peak" : who === "guest" ? "card" : who);
    }, 900);
  };

  const basketBtn = <button className="sl-cart" onClick={() => setStage("cart")} aria-label={`Basket, ${basketCount} items`}>{Ico.basket(20)}{basketCount > 0 ? <span className="n">{basketCount}</span> : null}</button>;
  const prow = (
    <div className="sl-prow">
      <Bottle s={wide ? 104 : 62} />
      <div><div className="nm">SynBIOTIC+</div><div className="tg">A living synbiotic that targets the inflammation aging you.</div></div>
    </div>
  );
  const insideBody = (<>
    {SCIENCE.map(([t, d], i) => <div className="sl-line" key={t} style={{ borderTop: i === 0 ? "none" : "" }}><div style={{ flex: "none", color: "var(--recovery-deep)", paddingTop: 2 }}>{Ico.check(16)}</div><div><div className="ln">{t}</div><div style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.45, marginTop: 2 }}>{d}</div></div></div>)}
    <div className="fx">
      <div className="fx-h">Supplement Facts</div>
      <div className="fx-serv"><span>Serving size <b>{FACTS.serving}</b></span></div>
      <div className="fx-rule" />
      <div className="fx-col">Amount per serving</div>
      {FACTS.actives.map(([n, v]) => <div className="fx-row" key={n}><span>{n}<sup>**</sup></span><b>{v}</b></div>)}
      <div className="fx-rule" />
      <div className="fx-macros">{FACTS.macros}</div>
      <div className="fx-foot">{FACTS.footnote}</div>
    </div>
    <a className="sl-detbtn" style={{ marginTop: 16 }} href="#/science" onClick={() => setInfo("")}>Full formulation &amp; science {Ico.arrow(13)}</a>
  </>);
  const proofBody = (<>
    <div className="co-grp">Built to be trusted</div>
    <div className="sl-proof-grid">{PROOF.map(([b, l]) => <div className="pf" key={l}><b>{b}</b><span>{l}</span></div>)}</div>
    <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontStyle: "italic", textAlign: "center", margin: "10px 0 0" }}>Currently in a joint clinical study with MSU-IIT.</div>
  </>);
  const watch = trials.find((t) => t.first);
  const packs = trials.filter((t) => !t.first);
  const buyBox = (<>
    <div className="sl-toggle x3">
      <button className={mode === "trial" ? "on" : ""} onClick={() => setMode("trial")}>Try first</button>
      <button className={mode === "protocol" ? "on" : ""} onClick={() => setMode("protocol")}>Full protocol</button>
      <button className={mode === "subscribe" ? "on" : ""} onClick={() => setMode("subscribe")}>Subscribe</button>
    </div>
    {mode === "trial" ? (
      <>
        <div className="sl-lab"><span>Start here · low risk</span></div>
        {watch ? (
          <button className={"sl-topt sl-wide-opt" + (trial.id === watch.id ? " on" : "")} onClick={() => setTrialSel(watch.id)} aria-pressed={trial.id === watch.id}>
            <div><div className="tn">{watch.name}</div><div className="tc">10 caps · 5 nights · new buyers</div></div>
            <div className="wr"><div className="tp">{peso(watch.price)}</div><span className="tfree">{basket.some((x) => x.kind === "watch") ? "✓ In your order" : "Free shipping"}</span></div>
          </button>
        ) : null}
        <div className="sl-topts">
          {packs.map((t) => (
            <button key={t.id} className={"sl-topt" + (trial.id === t.id ? " on" : "")} onClick={() => setTrialSel(t.id)} aria-pressed={trial.id === t.id}>
              <div className="tn">{t.name}</div><div className="tc">{t.caps} caps{pctOff(t.price, t.caps) ? <> · <span className="sv">Save {pctOff(t.price, t.caps)}%</span></> : ""}</div><div className="tp">{peso(t.price)}</div>
            </button>
          ))}
        </div>
        <div className="sl-note">{Ico.pulse(13)} {trial.first ? "Your 5 nights start the day your pack arrives. The ₱499 comes off your first monthly plan." : "The same living formula as the full protocol — try it before you commit."}</div>
      </>
    ) : mode === "protocol" ? (
      <>
        <div className="sl-lab"><span>When you&rsquo;re ready</span><span className="save">Save up to {pctOff(SL_TIERS[2].price, SL_TIERS[2].caps)}%</span></div>
        <div className="sl-chips">
          {SL_TIERS.map((t) => (
            <button key={t.id} className={"sl-chip" + (sel === t.id ? " on" : "")} onClick={() => setSel(t.id)} aria-pressed={sel === t.id}>
              {t.tag ? <span className="ctag">{t.tag}</span> : null}
              {sel === t.id ? <span className="cmk">{Ico.check(14)}</span> : null}
              <span className="cn">{t.name}</span><span className={"cpc sv" + (t.id === "peak" ? " svp" : "")}>Save {pctOff(t.price, t.caps)}%</span><span className="cd">{t.phase}</span>
            </button>
          ))}
        </div>
        <div className="sl-stats">
          <div className="sl-stat hl"><b key={sel + "p"}>{peso(pt.price)}</b><span>you save {peso(Math.round(pt.caps * BASE_CAP - pt.price))}</span></div>
          <div className="sl-stat"><b key={sel + "d"}>{pt.days}</b><span>days</span></div>
          <div className="sl-stat"><b key={sel + "c"}>{pt.caps}</b><span>capsules</span></div>
        </div>
        <div className="sl-note">{Ico.info(13)} {pt.id === "peak" ? "90 days on the 90-Day Protocol dose, which steps down as your score improves. Cash on Delivery or instalments available." : "Days at 2 capsules a day. Cash on Delivery available."}</div>
      </>
    ) : (
      <>
        <div className="sl-lab"><span>Gutguard Daily · Monthly</span><span className="save">Save {pctOff(MONTHLY, 10)}%</span></div>
        <div className="sl-chips">
          {GOALS.map((x) => (
            <button key={x.id} className={"sl-chip" + (goal === x.id ? " on" : "")} onClick={() => setGoal(x.id)} aria-pressed={goal === x.id}>
              {x.id === "better" ? <span className="ctag">Popular</span> : null}
              {goal === x.id ? <span className="cmk">{Ico.check(14)}</span> : null}
              <span className="cn sm">{x.goal}</span><span className="cpc">{x.perDay} a day</span><span className="cd">{x.mo} blisters</span>
            </button>
          ))}
        </div>
        <div className="sl-stats">
          <div className="sl-stat hl"><b key={goal + "m"}>{peso(g.mo * MONTHLY)}</b><span>you save {peso(Math.round(g.mo * 10 * BASE_CAP - g.mo * MONTHLY))}</span></div>
          <div className="sl-stat"><b key={goal + "b"}>{peso(MONTHLY)}</b><span>per blister</span></div>
          <div className="sl-stat"><b key={goal + "c"}>{g.mo * 10}</b><span>capsules</span></div>
        </div>
        {hasPlanNow ? <div className="co-planhint" style={{ marginTop: 0, marginBottom: 10 }}>You have Gutguard Daily. Change it in your <a {...linkTo(memberUrl("manage", who))}>Lifestyle page</a>, or buy a plan for someone else.</div> : null}
        <div className="sl-note">{Ico.pulse(13)} {who === "trial" ? "Your ₱499 trial credit comes off the first month. " : ""}Change, skip or cancel anytime. Every 3 months: {peso(QUARTERLY)} per blister (save {pctOff(QUARTERLY, 10)}%).</div>
      </>
    )}
    <div className="sl-trustline">
      <span className="t">{Ico.lock(12)} Secure</span>
      <span className="t">{Ico.shield(12)} FDA-registered</span>
      <span className="t">{Ico.pulse(12)} {shipText}</span>
    </div>
    {!member ? <a className="sl-free" href={joinUrl("shop")} {...link}>Not buying today? Join the movement with a free Lifestyle card</a> : null}
  </>);

  const lineRow = (it, edit) => (
    <div className="sl-line" key={it.id}>
      <div className="lc"><i /></div>
      <div><div className="ln">{it.name}</div><div className="ld">{it.sub}</div></div>
      {edit ? (it.kind === "once"
        ? <div className="sl-mq"><button onClick={() => setLineQty(it.id, it.qty - 1)} aria-label="Decrease">−</button><span className="q">{it.qty}</span><button onClick={() => setLineQty(it.id, it.qty + 1)} aria-label="Increase">+</button></div>
        : <button className="sl-rm" onClick={() => setLineQty(it.id, 0)}>Remove</button>) : <span className="sl-qx">× {it.qty}</span>}
      <div className="sl-lp">{peso(it.price * it.qty)}{it.kind === "daily" ? "/mo" : ""}</div>
    </div>
  );
  /* "+ Add more items" opens a short list inside the checkout. The buyer never leaves the checkout. */
  /* while typing a city, lift the field to the top of the sheet so the suggestions show above the keyboard */
  useEffect(() => {
    if (cityQ.trim().length < 2) return; const el = document.getElementById("co-cityq"); const sc = el && el.closest(".sl-co.on"); if (!sc || document.activeElement !== el) return;
    requestAnimationFrame(() => { const d = el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 12; if (Math.abs(d) > 20) sc.scrollTop = sc.scrollTop + d; }); /* instant: typing cancels a smooth scroll */
  }, [cityQ]);
  const [addOpen, setAddOpen] = useState(false);
  const [justAdded, setJustAdded] = useState("");
  const addChoices = [
    ...(firstOrder && !basket.some((x) => x.kind === "watch") && !basket.some((x) => x.kind === "daily") ? [{ id: "watch", kind: "watch", name: "5-Night Watch", sub: "10 caps · 5 nights · new buyers", price: 499, caps: 10 }] : []),
    ...SL_TRIALS.filter((t) => !t.first).map((t) => ({ id: t.id, kind: "once", name: "SynBIOTIC+ · " + t.name, short: t.name, sub: t.caps + " caps · " + peso(t.price) + " each", price: t.price, caps: t.caps })),
    ...SL_TIERS.map((t) => ({ id: t.id, kind: "once", name: "SynBIOTIC+ · " + t.name, short: t.name + " · " + t.phase, sub: t.caps + " caps · " + (t.id === "peak" ? "90-Day Protocol" : peso(t.price) + " each"), price: t.price, caps: t.caps })),
  ];
  const quickAdd = (c) => { const { short, caps, ...item } = c; setBasket((b) => put(b, item)); setJustAdded(c.id); setTimeout(() => setJustAdded((x) => (x === c.id ? "" : x)), 1400); };
  const addList = addOpen ? (
    <div className="co-add">
      {addChoices.map((c) => { const off = c.kind === "watch" ? 0 : pctOff(c.price, c.caps); const n = (basket.find((x) => x.id === c.id) || {}).qty || 0; return (
        <div className="co-add-row" key={c.id}>
          <div><b>{c.short || c.name}</b><small>{c.caps} caps{off ? <> · <span className="sv">Save {off}%</span></> : null}{n ? <> · {n} in order</> : null}</small></div>
          <span className="pr">{peso(c.price)}</span>
          <button onClick={() => quickAdd(c)} aria-label={"Add " + (c.short || c.name)}>{justAdded === c.id ? "✓" : "+ Add"}</button>
        </div>); })}
      <div className="co-add-foot"><button className="co-link" style={{ marginTop: 0 }} onClick={() => setAddOpen(false)}>Done adding</button>{!basket.some((x) => x.kind === "daily") ? <button className="co-link" style={{ marginTop: 0 }} onClick={() => { setAddOpen(false); close(); setMode("subscribe"); }}>Add a monthly plan ›</button> : null}</div>
    </div>
  ) : null;
  const sel2 = (k, label, opts, disabled, ph) => (
    <div className="co-f">
      <label htmlFor={"co-" + k}>{label}</label>
      <select id={"co-" + k} value={form[k]} disabled={disabled} onChange={(e) => { setForm(k === "province" ? { ...form, province: e.target.value, city: "", brgy: "" } : k === "city" ? { ...form, city: e.target.value, brgy: "" } : { ...form, [k]: e.target.value }); if (k === "brgy" && e.target.value) focusNext("co-st"); }}>
        <option value="">{ph}</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
  const [, setBrgyTick] = useState(0);
  useEffect(() => { if (stage === "checkout" && BRGY === null) loadBrgy().then(() => setBrgyTick((n) => n + 1)); }, [stage]);
  const brgyList = BRGY ? BRGY[form.city + "|" + form.province] || [] : null; /* null = still loading; BRGY false = could not load → type it */
  const trustLine = (
    <div className="sl-trust2"><span>{Ico.check(12)} FDA-registered</span><span>{Ico.lock(12)} Secure payment by PayMongo</span><a href="#/legal" onClick={close}>Refund policy</a></div>
  );

  return (
    <>
      {wide ? (
        <div className="sl sl-page sl-wide" id="buy">
          <div className="slw-left">
            {prow}
            <h3 className="slw-h">What&rsquo;s inside</h3>
            <div className="sl-dets">{insideBody}</div>
            <h3 className="slw-h">Why trust this</h3>
            <div className="sl-dets">{proofBody}</div>
          </div>
          <div className="slw-right">
            <div className="slw-card">
              <div className="sl-top slw-top"><span className="slw-t">Choose how to start</span>{basketBtn}</div>
              {buyBox}
              <button className="btn-primary slw-buy" onClick={onBuy}>{bar}</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="sl sl-page" id="buy">
            <div className="sl-top">{prow}{basketBtn}</div>
            {buyBox}
            <div className="sl-detrow">
              <button className="sl-detbtn" onClick={() => setInfo("inside")}>{Ico.info(12)} What&rsquo;s inside</button>
              <button className="sl-detbtn" onClick={() => setInfo("proof")}>{Ico.shield(12)} Why trust this</button>
            </div>
            <div className="sl-spacer" />
          </div>
          <div className="sl-bar"><button className="btn-primary" onClick={onBuy}>{bar}</button></div>
        </>
      )}

      <div className={"sl-scrim" + (sheetOpen ? " on" : "")} onClick={() => { setInfo(""); if (stage !== "done") close(); }} />
      {!wide ? (<>
        <div className={"sl-sheet sl-dets" + (info === "inside" ? " on" : "")} role="dialog" aria-label="What's inside">
          <div className="sl-grip" />
          <div className="sl-sh-h">What&rsquo;s inside <button onClick={() => setInfo("")} aria-label="Close">{Ico.x(22)}</button></div>
          {insideBody}
        </div>
        <div className={"sl-sheet sl-dets" + (info === "proof" ? " on" : "")} role="dialog" aria-label="Why trust this">
          <div className="sl-grip" />
          <div className="sl-sh-h">Why trust this <button onClick={() => setInfo("")} aria-label="Close">{Ico.x(22)}</button></div>
          {proofBody}
        </div>
      </>) : null}

      {/* 1 · basket */}
      <div className={"sl-sheet" + (stage === "cart" ? " on" : "")} role="dialog" aria-label="Basket">
        <div className="sl-grip" />
        <div className="sl-sh-h">Your basket <button onClick={close} aria-label="Close">{Ico.x(22)}</button></div>
        {conflict ? (
          <div className="sl-conflict" role="alert">
            <b>You don&rsquo;t need the trial if your plan starts now.</b>
            <span>The 5-Night Watch is for trying before a plan. Which do you want to keep?</span>
            <div className="cf-btns">
              <button onClick={keepPlan}>Keep my plan</button>
              <button onClick={keepWatch}>Keep 5-Night Watch</button>
            </div>
          </div>
        ) : null}
        {basket.length === 0 ? <div className="sl-empty">Your basket is empty.</div> : (
          <>
            {basket.map((it) => lineRow(it, true))}
            <div className="sl-ship"><span>Shipping</span><span>{hasOnce ? peso(ORDER_SHIP) : isWatch ? "Free shipping" : "Free delivery"}</span></div>
            <div className="sl-eta">{Ico.pulse(12)} {etaFor(form.province)}</div>
            {credit ? <div className="sl-ship" style={{ borderTop: "none", paddingTop: 4, marginTop: 4 }}><span>₱499 trial credit</span><span style={{ color: "var(--recovery-deep)" }}>−{peso(credit)}</span></div> : null}
            {saved ? <div className="sl-ship" style={{ borderTop: "none", paddingTop: 4, marginTop: 4 }}><span>You save</span><span style={{ color: "var(--recovery-deep)", fontWeight: 600 }}>{peso(saved)}</span></div> : null}
            <div className="sl-tot"><span>Total today</span><span className="amt">{peso(totalToday)}</span></div>
            {daily ? <div className="sl-conote" style={{ marginTop: -4, marginBottom: 10 }}>Then {peso(daily.price)} a month, free delivery. Change, skip or cancel anytime.</div> : null}
            <button className="btn-primary" onClick={() => { setStage("checkout"); toTop(); }}>Checkout {Ico.arrow(18)}</button>
            {trustLine}
            <div className="sl-conote" style={{ marginTop: 4 }}>Your basket is saved on this device.</div>
          </>
        )}
      </div>

      {/* 2 · checkout — one sheet: contact, delivery, payment */}
      <div ref={stage === "checkout" ? sheetRef : null} className={"sl-sheet sl-co" + (stage === "checkout" ? " on" : "")} role="dialog" aria-label="Checkout">
        <div className="sl-grip" />
        <div className="sl-sh-h"><span className="bk">Checkout</span><button onClick={close} aria-label="Close">{Ico.x(22)}</button></div>
        {payFail ? (
          <div className="co-fail" role="alert">
            <b>{FAIL_TEXT[payFail] || "The payment did not go through."} Nothing was charged.</b>
            <span>Your order and details are saved. Try again, or choose another way to pay.</span>
            <div className="cf-btns">
              <button onClick={() => { setPayFail(null); tryPay(); }}>Try again</button>
              <button onClick={() => { setPayFail(null); const el = document.getElementById("co-pay"); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }}>Pay another way</button>
            </div>
          </div>
        ) : null}
        {conflict ? (
          <div className="sl-conflict" role="alert">
            <b>You don&rsquo;t need the trial if your plan starts now.</b>
            <span>The 5-Night Watch is for trying before a plan. Which do you want to keep?</span>
            <div className="cf-btns">
              <button onClick={keepPlan}>Keep my plan</button>
              <button onClick={keepWatch}>Keep 5-Night Watch</button>
            </div>
          </div>
        ) : null}
        <div className="co-grp" style={{ marginTop: 0 }}>Your order</div>
        <div className="co-items" id="co-items">
          {basket.length ? basket.map((it) => lineRow(it, true)) : <div className="sl-empty" style={{ padding: "14px 0" }}>Nothing here yet.</div>}
          <button className="co-link" style={{ marginTop: 8 }} onClick={() => { setAddOpen((v) => !v); if (!addOpen) setTimeout(() => { const el = document.querySelector(".sl-co.on .co-add"); if (el) bringIntoView(el); }, 60); }} aria-expanded={addOpen}>{addOpen ? "− Hide the list" : "+ Add more items"}</button>
          {addList}
        </div>

        <div className="co-grp" id="co-for">Who is it for?</div>
        <div className="co-for" role="radiogroup" aria-label="Who is it for?">
          <button role="radio" aria-checked={!forOther} className={!forOther ? "on" : ""} onClick={() => pickFor(false)}>Me</button>
          <button role="radio" aria-checked={forOther} className={forOther ? "on" : ""} onClick={() => pickFor(true)}>Someone else</button>
        </div>
        {planForMe ? <div className={"co-planhint" + (tried ? " err" : "")}>You already have Gutguard Daily. Change it in your <a {...linkTo(memberUrl("manage", who))}>Lifestyle page</a>, or choose <b>Someone else</b>.</div> : null}

        <div className="co-grp">{forOther ? "You (paying)" : "You"}</div>
        {member && !codeSent && verified ? (
          <div className="co-saved"><span><b>{form.name}</b> · {form.mobile} <em>{Ico.check(12)} Lifestyle member</em></span></div>
        ) : (<>
          <div className={"co-f" + (tried && !verified ? " err" : "")} id="co-mobile">
            <label htmlFor="co-m">Mobile number</label>
            <div className="co-inline">
              <input id="co-m" type="tel" inputMode="tel" autoComplete="tel" placeholder="0917 123 4567" value={form.mobile} disabled={verified} onChange={(e) => { const v = fmtMobile(e.target.value); setForm({ ...form, mobile: v }); setVerified(false); setCode(""); setCodeSent(v.replace(/\D/g, "").length === 11); if (v.replace(/\D/g, "").length === 11) focusNext("co-code"); }} />
              {verified ? <span className="co-ok2">{Ico.check(14)} Verified</span> : null}
            </div>
            {codeSent && !verified ? (
              <div style={{ marginTop: 8 }}>
                <input id="co-code" className="co-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={code} onChange={(e) => typeCode(e.target.value)} aria-label="6-digit code" />
                <span className="fe" style={{ color: "var(--ink-3)" }}>Code sent to {form.mobile}. On most phones it fills in by itself. <button className="co-again" onClick={sendCode}>Send again</button> · Demo: type any 6 digits.</span>
              </div>
            ) : !verified ? <span className="fe" style={{ color: tried ? "var(--heat-text)" : "var(--ink-3)" }}>We text you a code as soon as the number is complete. Your free Lifestyle card uses this number.</span> : null}
          </div>
          <div className={"co-f" + (tried && form.name.trim().length < 2 ? " err" : "")} id="co-name">
            <label htmlFor="co-n">Full name</label>
            <input id="co-n" autoComplete="name" placeholder="Juan dela Cruz" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
        </>)}
        {forOther ? (<div id="co-rcp">
          <div className="co-grp">Their details</div>
          <div className={"co-f" + (tried && rcp.name.trim().length < 2 ? " err" : "")}>
            <label htmlFor="co-rn">Their full name</label>
            <input id="co-rn" autoComplete="off" placeholder="e.g. Lorna Aquino" value={rcp.name} onChange={(e) => setRcp({ ...rcp, name: e.target.value })} />
          </div>
          <div className={"co-f" + (tried && !rcpOk && rcp.name.trim().length > 1 ? " err" : "")}>
            <label htmlFor="co-rm">Their mobile number</label>
            <input id="co-rm" type="tel" inputMode="tel" autoComplete="off" placeholder="0917 123 4567" value={rcp.mobile} onChange={(e) => { const v = fmtMobile(e.target.value); setRcp({ ...rcp, mobile: v }); if (v.replace(/\D/g, "").length === 11) focusNext("co-cityq"); }} />
            <span className="fe" style={{ color: "var(--ink-3)" }}>{rcpDigits === 11 && rcp.mobile.replace(/\D/g, "") === form.mobile.replace(/\D/g, "") ? "This is your own number. Choose Me instead." : "Guard your family too. We text them their own free Lifestyle card, and they join under you."}</span>
          </div>
        </div>) : null}
        {swapNote ? (
          <div className="co-swap" role="status">
            <b>This number has a recent order with us.</b>
            The 5-Night Watch is for new buyers, and for anyone with no order in the last 12 months. Your order now has a Blister ({peso(1499)}, 10 capsules) instead.
            <div><button onClick={() => { setSwapNote(false); setStage("shop"); setMode("subscribe"); }}>Or choose a monthly plan and save {pctOff(MONTHLY, 10)}%</button></div>
          </div>
        ) : null}

        <div className="co-grp" id="co-addr">{forOther ? "Deliver to " + (firstName(rcp.name) || "them") : "Deliver to"}</div>
        {!editAddr && addrOk ? (
          <div className="co-saved"><span>{form.street}, {form.brgy}, {form.city}, {form.province}<em className="eta">{etaFor(form.province)}</em></span><button onClick={() => setEditAddr(true)}>Change</button></div>
        ) : (<div className={tried && !addrOk ? "co-need" : ""}>
          <div className="co-f co-city">
            <label htmlFor="co-cityq">City or municipality</label>
            {form.city ? (
              <div className="co-pick"><span><b>{form.city}</b> · {form.province}</span><button onClick={() => { setForm({ ...form, city: "", province: "", brgy: "" }); setCityQ(""); setTimeout(() => { const el = document.getElementById("co-cityq"); if (el) el.focus(); }, 0); }}>Change</button></div>
            ) : (<>
              <input id="co-cityq" autoComplete="off" placeholder="Type your city, e.g. General Santos" value={cityQ} onChange={(e) => setCityQ(e.target.value)} />
              {findCities(cityQ).length ? (
                <div className="co-sugg" role="listbox">
                  {findCities(cityQ).map((c) => <button key={c.city + c.province} role="option" onClick={() => { setForm({ ...form, city: c.city, province: c.province, brgy: "" }); setCityQ(""); focusNext("co-brgy"); }}><b>{c.city}</b><span>{c.province}</span></button>)}
                </div>
              ) : cityQ.trim().length >= 2 ? <span className="fe" style={{ color: "var(--ink-3)" }}>No match yet. Try the first letters of your city or town.</span> : null}
            </>)}
          </div>
          {form.city ? (BRGY === false || (brgyList && !brgyList.length)
            ? <div className="co-f"><label htmlFor="co-brgy">Barangay</label><input id="co-brgy" autoComplete="address-level3" placeholder="Type your barangay" value={form.brgy} onChange={(e) => setForm({ ...form, brgy: e.target.value })} /></div>
            : sel2("brgy", "Barangay", brgyList || [], !brgyList, brgyList ? "Choose barangay" : "Loading barangays…")) : null}
          {form.city ? <div className="co-f"><label htmlFor="co-st">House no. and street</label><input id="co-st" autoComplete="address-line1" placeholder="e.g. 12 Rizal St." value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} /></div> : null}
          {form.province ? <div className="sl-eta">{Ico.pulse(12)} {etaFor(form.province)}</div> : null}
        </div>)}

        <div className="co-grp" id="co-pay">Pay with</div>
        <div className="co-pays">
          {payOptions.map(([k, l, n]) => (
            <button key={k} className={"co-pay" + (payKey === k ? " on" : "")} onClick={() => setPay(k)} aria-pressed={payKey === k}><span className="rd" /><span><b>{l}</b><small>{n}</small></span></button>
          ))}
        </div>
        {payKey === "install" ? (
          <div className="co-install">
            <div className="co-months" style={{ gridTemplateColumns: "1fr 1fr" }}>{[3, 6].map((m) => <button key={m} className={"co-mo" + (months === m ? " on" : "")} onClick={() => setMonths(m)} aria-pressed={months === m}>{m} months</button>)}</div>
            <div className="co-morow"><span>About, per month</span><b>{peso(perMonth)}</b></div>
            <div className="co-monote">Shown at 0% to help you plan. The final terms and any interest come from the instalment provider when you apply.</div>
          </div>
        ) : null}
        {payKey === "cod" ? <div className="co-cardnote">{Ico.info(13)} Please have {peso(totalToday)} ready in cash for the courier.</div> : null}
        {(payKey === "gcash" || payKey === "maya") ? <div className="co-cardnote">{Ico.lock(13)} You confirm in the {payKey === "gcash" ? "GCash" : "Maya"} app. Your details stay saved here.</div> : null}
        {payKey === "card" ? <div className="co-cardnote">{Ico.lock(13)} Card details go straight to PayMongo. They never touch our servers.</div> : null}

        <div className="co-tots">
          <div><span>Items</span><span>{peso(itemsTotal)}</span></div>
          {credit ? <div><span>₱499 trial credit</span><span className="good">−{peso(credit)}</span></div> : null}
          {saved ? <div><span>You save <small style={{ color: "var(--ink-3)" }}>vs. buying Blisters</small></span><span className="good">{peso(saved)}</span></div> : null}
          <div><span>{hasOnce ? "Shipping" : "Delivery"}</span><span>{ship ? peso(ship) : "Free"}</span></div>
          <div><span>E-Points you earn</span><span className="gold">+{pts}</span></div>
          <div className="big"><span>{payKey === "cod" ? "Pay on delivery" : payKey === "install" ? "Total, in instalments" : "Total today"}</span><b>{peso(totalToday)}</b></div>
          {daily ? <div className="then">Then {peso(daily.price)} a month from {addDays(30)}.</div> : null}
        </div>
        {daily ? (
          <label className={"co-agree" + (tried && !subAgree ? " err" : "")} id="co-agree"><input type="checkbox" checked={subAgree} onChange={(e) => setSubAgree(e.target.checked)} /><span>{forOther ? "This plan renews every month until I cancel. I pay for it." : "My plan renews every month until I cancel."} I agree to the <u>Subscription Terms</u>.</span></label>
        ) : null}
        {!member ? (refOpen
          ? <div className="co-f" style={{ marginTop: 12 }}><label htmlFor="co-ref">Referral code · optional</label><input id="co-ref" placeholder="e.g. ANACRUZ" value={refCode} onChange={(e) => setRefCode(e.target.value.toUpperCase())} /></div>
          : <button className="co-link" onClick={() => setRefOpen(true)}>Have a referral code?</button>) : null}
        <div className="co-paywrap">
          <button className="btn-primary co-paybtn" onClick={tryPay} disabled={paying}>{payLabel}</button>
          {tried && !canPay ? <div className="co-hint">{!basket.length ? "Your order is empty. Add an item first." : planForMe ? "You already have a plan. Choose Someone else, or change your plan in your Lifestyle page." : !verified ? "Confirm your mobile number first." : form.name.trim().length < 2 ? "Add your full name." : !rcpOk ? "Add their full name and mobile number." : !addrOk ? "Add your delivery address." : "Tick the renewal box."}</div> : null}
        </div>
        {trustLine}
        <div className="sl-conote" style={{ marginTop: 6 }}>By paying, you agree to the <u>Terms of Sale</u> and the <u>Privacy Notice</u>.{!member ? " Your free Lifestyle card is made from these details." : ""}</div>
      </div>

      {/* 3 · done */}
      <div ref={stage === "done" ? sheetRef : null} className={"sl-sheet sl-co" + (stage === "done" ? " on" : "")} role="dialog" aria-label="Order placed">
        <div className="sl-grip" />
        {order ? (
          <div className="co-ok">
            <div className="ic">{Ico.check(30)}</div>
            <h3>{order.pay === "cod" ? "Order placed." : order.pay === "install" ? "Instalments approved." : "Payment confirmed."}</h3>
            <p>{order.forOther ? <>Your order for <b>{order.rcpName}</b> is in.{order.newMember ? " Your Lifestyle card is ready too." : ""}</> : order.becameGuardian ? <>Welcome, Gut Guardian. Your card is ready, <b>{firstName(order.name)}</b>. <i className="cry-in">We Gut You.</i></> : order.newMember ? <>Your Lifestyle card is ready, <b>{firstName(order.name)}</b>.</> : <>Thank you, <b>{firstName(order.name)}</b>.</>}</p>
            {order.newMember || order.becameGuardian ? (
              <div className="mini-card"><span className="mc-l">{order.becameGuardian ? "GUT GUARDIAN" : "LIFESTYLE MEMBER"}</span><span className="mc-n">{order.name.toUpperCase()}</span><span className="mc-p"><b>+{order.pts}</b> E-Points</span></div>
            ) : <div className="co-pts"><b>+{order.pts}</b> E-Points</div>}
            <div className="co-next">
              <div className="sl-line" style={{ borderTop: "none" }}><div className="nx">01</div><div><div className="ln">{order.forOther ? `We ship to ${firstName(order.rcpName)}` : order.isWatch ? "Your pack is on its way" : "We prepare and ship"}</div><div className="ld2">{etaFor(order.province)}.{order.withOthers ? " Your other items come in the same box." : ""} We text you when it ships.{order.pay === "cod" ? ` Pay ${peso(order.total)} in cash to the courier.` : ""}{order.pay === "install" ? ` About ${peso(Math.ceil(order.total / order.months))} a month for ${order.months} months, paid to the provider.` : ""}</div></div></div>
              <div className="sl-line"><div className="nx">02</div><div><div className="ln">{order.forOther ? (order.isWatch ? "Night 1 starts when it arrives" : "Their daily dose") : order.isWatch ? "Night 1 starts by itself" : order.peak ? "Your starting dose" : "Your daily dose"}</div><div className="ld2">{order.isWatch ? TRIAL_DOSE.map(([a, b]) => a + ": " + b).join(" · ") + "." + (order.forOther ? "" : " Finish your 5 nights and you become a Gut Guardian.") : (() => { const q = GOALS.find((x) => x.id === order.doseGoal); return (q.mid ? `${q.rev} at Reveille, ${q.mid} at Midday, ${q.taps} at Taps.` : `${q.rev} at Reveille, ${q.taps} at Taps.`) + (q.mid ? " You can adjust it in Settings." : " You can adjust it, or add a Midday dose, in Settings.") + (order.peak ? " It steps down as your score improves." : ""); })()}</div></div></div>
              {order.forOther
                ? <div className="sl-line"><div className="nx">03</div><div><div className="ln">{firstName(order.rcpName)} gets a free Lifestyle card</div><div className="ld2">We sent it by SMS. They track their doses there and join under you. The E-Points are yours{order.daily ? `. You manage their plan in your Lifestyle page` : ""}.</div></div></div>
                : <div className="sl-line"><div className="nx">03</div><div><div className="ln">Track it in your Lifestyle page</div><div className="ld2">Doses, reminders, E-Points{order.daily ? `, and your next refill on ${addDays(30)}` : ""}.</div></div></div>}
            </div>
            <label className="co-agree" style={{ marginTop: 0, textAlign: "left" }}><input type="checkbox" checked={smsOk} onChange={(e) => setSmsOk(e.target.checked)} /><span style={{ textAlign: "left" }}>Send me Gutguard tips and offers by SMS (optional)</span></label>
            <a className="btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 14 }} href={LIFESTYLE_HOME + "#" + (order.forOther ? (order.newMember ? "card" : "member") : order.isWatch ? "ordered" : "member") + (order.becameGuardian ? "~guardian" : "~welcome")} {...link}>Open my Lifestyle page {Ico.arrow(18)}</a>
            <button className="co-link" style={{ display: "block", margin: "12px auto 0" }} onClick={() => { setStage("shop"); setOrder(null); }}>Back to the shop</button>
          </div>
        ) : null}
      </div>
    </>
  );
}

function Physicians() {
  const offers = [
    ["Upstream framing", "Read inflammation with GLIS, before it becomes a labelled condition."],
    ["Filipino-authored, global-standard science", "Co-developed with MSU-IIT and MERAV, registered with the FDA."],
    ["Clinical dosing guidance", "A structured protocol and doctor-facing tools, not a sales script."],
    ["A founding circle", "Among the first 100 licensed Filipino physicians practising at the upstream."],
  ];
  return (
    <>
      <header className="lca-hero dark">
        <div className="wrap"><div className="narrow reveal" style={{ maxWidth: 760 }}>
          <span className="eyebrow">For Physicians · Lead Clinical Adopters</span>
          <h1>Practice medicine at the <em>upstream.</em></h1>
          <p className="hero-lede">An invitation to the first 100 founding Filipino physicians treating mitochondrial dysfunction and inflammaging — with measurement, not guesswork.</p>
          <div className="hero-actions"><a className="btn-primary" href="#/physicians">Request the program brief <Arrow /></a></div>
        </div></div>
      </header>

      <hr className="seam" />

      <section className="section"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="practice"><span className="num">01</span> What you’d practice</div>
          <h2 className="sec">Inflammation you can <em>read</em> — and act on early.</h2>
          <p className="sec-body">The GLIS composite turns routine lab markers into one upstream signal — so you can act before downstream conditions take hold.</p>
        </div>
        <div className="offer-grid reveal">
          {offers.map(([h, p]) => (
            <div className="offer" key={h}><span className="ck" aria-hidden="true"><Check size={15} /></span><div><h3>{h}</h3><p>{p}</p></div></div>
          ))}
        </div>
      </div></section>

      <section className="section" style={{ background: "var(--slate)", position: "relative", overflow: "hidden" }}><Constellation /><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="rationale" style={{ color: "var(--slate-mut)" }}><span className="num">02</span> The recovery rationale</div>
          <h2 className="sec" style={{ color: "#F4F1EA" }}>A layered <em>recovery</em> system — not just a probiotic.</h2>
          <p className="sec-body" style={{ color: "#B8C6D6" }}>SynBIOTIC+ pairs a spore-forming probiotic with prebiotic, postbiotic and antioxidant layers — a layered design, uncommon among probiotics, positioned as post-antibiotic gut and cellular recovery. Described as support, not the treatment or prevention of any disease.</p>
        </div>
        <div className="layers comp-layers reveal">
          <div className="layer"><span className="lyr-tag">Prebiotic</span><div><h3>FOS (fructo-oligosaccharides)</h3><p>Feeds beneficial microbes and supports recolonisation of the gut after antibiotic exposure.</p></div></div>
          <div className="layer"><span className="lyr-tag">Probiotic</span><div><h3>Spore-forming <i>Bacillus coagulans</i> (LactoSpore®)</h3><p>Its spore coat survives gastric acid to reach the gut, helping restore microbiome balance and resilience during and after antibiotics. Similar Bacillus and multi-strain formulations have shown benefit in antibiotic-associated diarrhoea<sup><a href="#pref1">1</a></sup>, with modulation of gut microbiota and inflammatory cytokines<sup><a href="#pref2">2</a></sup>; broader meta-analyses report a reduced risk of <i>C. difficile</i>-associated diarrhoea in patients receiving antibiotics<sup><a href="#pref3">3</a></sup>.</p></div></div>
          <div className="layer"><span className="lyr-tag">Postbiotic</span><div><h3>Urolithin-A + L-Tryptophan</h3><p>Urolithin-A supports mitochondrial renewal (mitophagy); L-tryptophan is a precursor in gut–immune and gut–brain signalling — extending recovery from the microbiome to cellular energy.</p></div></div>
          <div className="layer"><span className="lyr-tag">Antioxidant</span><div><h3>Glutathione + Lutein</h3><p>Help buffer the oxidative stress that accompanies inflammation and tissue repair.</p></div></div>
        </div>
        <ol className="ref-list dark reveal">
          <li id="pref1">Hempel S, Newberry SJ, Maher AR, et al. Probiotics for the prevention and treatment of antibiotic-associated diarrhea: a systematic review and meta-analysis. <i>JAMA</i>. 2012;307(18):1959–1969. doi:10.1001/jama.2012.3507</li>
          <li id="pref2">Madempudi RS, Ahire JJ, Neelamraju J, Tripathi A, Nanal S. Randomized clinical trial: the effect of probiotic Bacillus coagulans Unique IS2 vs. placebo on the symptoms management of irritable bowel syndrome in adults. <i>Scientific Reports</i>. 2019;9:12210. doi:10.1038/s41598-019-48554-x</li>
          <li id="pref3">Goldenberg JZ, Yap C, Lytvyn L, et al. Probiotics for the prevention of Clostridioides difficile-associated diarrhea in adults and children. <i>Cochrane Database of Systematic Reviews</i>. 2017;12:CD006095. doi:10.1002/14651858.CD006095.pub4</li>
        </ol>
      </div></section>

      <TrustStrip />

      <FinalCTA label="The founding 100" title={<>Read the inflammation. <em>Practise the upstream.</em></>} body="Request the LCA program brief and clinical dosing guidance for licensed Filipino physicians." cta="Request the program brief" />
      <Compliance />
    </>
  );
}

function FinalCTA({ label = "Measured, not guessed.", title = <>Your first number is the start of <em>the story.</em></>, body = "Start with five nights and a free Lifestyle card. Your BioScan checkpoints come at Day 30, 60 and 90 (Beta).", cta = "Start my 5 nights", href, external }) {
  const { who } = useVisitor();
  const m = isMember(who);
  const to = href || (m ? memberUrl("member", who) : "#/shop?start=watch");
  const out = external || !href;
  const label2 = !href && m ? "Open my Lifestyle page" : cta;
  return (
    <section className="final"><div className="wrap final-in reveal">
      <div className="lab">{label}</div>
      <h2>{title}</h2>
      <p>{body}</p>
      <a className="btn-bone" href={to} {...(out ? { target: "_blank", rel: "noopener" } : {})}>{label2} <span className="arr"><ArrowRight size={14} /></span></a>
    </div></section>
  );
}

function System() {
  const layers = [
    ["01", "BioScan", "Sample", "You provide your own blood test results — upload the file or photograph it. The system scans a defined set of biomarkers from any standard lab test, then rates data confidence.", "who", "Input"],
    ["02", "GLIS", "Score", "Gutguard Lifestyle Inflammation Score — a 0–100 reading of low-grade chronic systemic inflammation (inflammaging) across inflammatory, metabolic, adiposity and organ-function markers, with a data-confidence rating. Scattered markers become one signal.", "who md", "Physician-facing"],
    ["03", "MiAge", "Translate", "MiAge says the science in years — one number you feel, with the gap you can close. Re-tested over time, so every scan shows direction, not just a snapshot.", "who pt", "Patient-facing"],
  ];
  return (
    <>
      <header className="hero">
        <div className="wrap"><div className="narrow reveal" style={{ maxWidth: 760 }}>
          <span className="eyebrow">The System</span>
          <h1>Three layers between a <em>sample</em> and an answer.</h1>
          <p className="hero-lede">No single number tells the whole story. Gutguard reads inflammation through a measured stack — a sample, a composite score, and a translation you can actually feel.</p>
          <div className="hero-actions">
            <StartCTA />
            <a className="btn-ghost" href="#/physicians"><span className="ring"><ArrowRight size={13} /></span>For physicians</a>
          </div>
        </div></div>
      </header>

      <hr className="seam" />

      <section className="section"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="stack"><span className="num">01</span> The stack</div>
          <h2 className="sec">From your lab results to <em>meaning.</em></h2>
          <p className="sec-sub">Built on routine, accessible lab markers — repeatable anywhere.</p>
        </div>
        <div className="layers reveal">
          {layers.map(([n, name, sub, p, whoCls, who]) => (
            <div className="layer" key={name}>
              <div className="lnum" aria-hidden="true">{n}</div>
              <div><h3>{name}<span className="sub">{sub}</span></h3><p>{p}</p></div>
              <div className={whoCls}>{who}</div>
            </div>
          ))}
        </div>

        <div className="reveal" style={{ marginTop: 56 }}>
          <h3 className="sub-h">How the Blood Scan works</h3>
          <p className="sec-body" style={{ marginBottom: 26 }}>No kit, no partner lab. The Blood Scan (BioScan) reads the blood test results you already have — you just upload or photograph them.</p>
        </div>
        <div className="howscan reveal">
          {[["1", "Bring your lab results", "Use a recent blood test you already have, or get a standard one anywhere. No special kit or partner lab required."],
            ["2", "Upload or photograph it", "Load the file or simply take a picture. The Blood Scan reads it for you."],
            ["3", "The system scans your biomarkers", "It extracts a defined set of biomarkers across inflammation, metabolism, and organ function — and rates your data confidence by how complete they are."],
            ["4", "Get your score", "Your biomarkers generate two reads: your Lifestyle Inflammation Score (GLIS) — your inflammaging — and your MiAge, your biological age from the same markers, via the PhenoAge method. Re-test by scanning new results at Day 30, 60, and 90."]].map(([n, h, p]) => (
            <div className="howstep" key={n}><div className="hs-n" aria-hidden="true">{n}</div><h4>{h}</h4><p>{p}</p></div>
          ))}
        </div>
        <div className="reveal" style={{ marginTop: 56 }}>
          <h3 className="sub-h">Choose your panel — confidence scales with completeness</h3>
          <p className="sec-body" style={{ marginBottom: 26 }}>MiAge reads whatever markers you bring, and shows how confident that read is. A basic panel gives a screening estimate; a complete panel anchors it on the validated PhenoAge algorithm; advanced adds insulin resistance and body composition.</p>
        </div>
        <div className="tiers reveal">
          {[
            ["Essential", "Widest access", ["CBC", "Fasting glucose", "Lipid profile", "Creatinine", "Uric acid", "hs-CRP", "Waist / BMI"], "Screening-grade GLIS and a provisional MiAge estimate.", "Moderate confidence"],
            ["Complete", "The standard", ["Everything in Essential", "Albumin + ALP", "HbA1c"], "All PhenoAge markers present — MiAge anchored on the validated PhenoAge algorithm, extended with your metabolic markers.", "High confidence"],
            ["Advanced", "Fullest picture", ["Everything in Complete", "Fasting insulin → HOMA-IR", "Body composition / visceral fat", "Advanced inflammatory markers"], "The complete cardiometabolic read, tuned to your metabolic profile.", "Highest confidence"],
          ].map(([name, tagline, items, claim, conf]) => (
            <div className={"tier" + (name === "Complete" ? " tier-mid" : "")} key={name}>
              <div className="tier-h"><span className="tier-name">{name}</span><span className="tier-tag">{tagline}</span></div>
              <ul className="tier-list">{items.map((it) => <li key={it}>{it}</li>)}</ul>
              <p className="tier-claim">{claim}</p>
              <span className="tier-conf">{conf}</span>
            </div>
          ))}
        </div>
        <p className="tier-note">Confidence is shown with every result — never more than your data earns. Read MiAge as a way to track your own progress over time, not a medical diagnosis — and our model is still being validated.</p>
      </div></section>

      <section className="section measure"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="proof"><span className="num">02</span> Proof of method</div>
          <h2 className="sec">A number means little. <em>A trajectory</em> means everything.</h2>
          <p className="sec-sub">Re-tested at Day 30, 60, and 90 — the method proves itself on your own line.</p>
        </div>
        <Trajectory note={<>Because the same markers are read the same way each time, change is measurable — not anecdotal. <b>The method is only as good as its repeatability</b>, and that is the whole point of re-testing.</>} />
      </div></section>

      <section className="section"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="readings"><span className="num">03</span> Read two ways</div>
          <h2 className="sec">One measurement. <em>Two</em> honest readings.</h2>
          <p className="sec-sub">The same science, told to the person and to the physician.</p>
        </div>
        <div className="dual reveal">
          <div className="col pt"><div className="tag">What you see</div><h3>MiAge</h3><div className="full">Mitochondrial Age</div><div className="big">53<span style={{ fontSize: 22 }}>y</span></div><p>Your biological age from the same labs — anchored on the validated PhenoAge algorithm and extended with your cardiometabolic markers. Named for the mitochondrial aging that inflammaging drives. Yours to track at every re-test.</p></div>
          <div className="col md"><div className="tag">What your doctor sees</div><h3>GLIS</h3><div className="full">Gutguard Lifestyle Inflammation Score</div><div className="big">62</div><p>The 0–100 measure of low-grade chronic systemic inflammation — inflammaging — across inflammatory, metabolic, adiposity and organ-function markers, with a data-confidence rating. The measured foundation of your MiAge.</p></div>
        </div>
        <div className="vault reveal"><Lock size={20} /><span>Some upstream methodology is held as protected intellectual property and isn’t shown publicly — what you see here are the disclosable layers of the system.</span></div>
      </div></section>

      <TrustStrip />
      <Compliance />
    </>
  );
}

const ROUTES = { "/": Home, "/science": Science, "/system": System, "/shop": Shop, "/physicians": Physicians, "/about": About, "/legal": Legal };

function SectionTabs({ items }) {
  const [active, setActive] = useState(items[0][1]);
  const [top, setTop] = useState(60);
  const innerRef = useRef(null);
  const vis = useRef(new Set());

  /* sit flush under the nav, whatever its measured height */
  useEffect(() => {
    const measure = () => { const n = document.querySelector(".nav"); if (n) setTop(n.offsetHeight); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  /* scrollspy */
  useEffect(() => {
    const ids = items.map((i) => i[1]);
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { e.isIntersecting ? vis.current.add(e.target.id) : vis.current.delete(e.target.id); });
        const first = ids.find((id) => vis.current.has(id));
        if (first) setActive(first);
      },
      { rootMargin: "-118px 0px -60% 0px", threshold: 0 }
    );
    ids.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [items]);

  /* keep the active tab centered in the mobile strip (no window scroll) */
  useEffect(() => {
    const c = innerRef.current; if (!c) return;
    const el = c.querySelector(".sectab.on");
    if (el) c.scrollLeft = el.offsetLeft - c.clientWidth / 2 + el.clientWidth / 2;
  }, [active]);

  const go = (id) => {
    const el = document.getElementById(id); if (!el) return;
    const n = document.querySelector(".nav");
    const t = document.querySelector(".sectabs");
    const offset = (n ? n.offsetHeight : 60) + (t ? t.offsetHeight : 48) + 6;
    const y = el.getBoundingClientRect().top + window.scrollY - offset;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <nav className="sectabs show" style={{ top }} aria-label="On this page">
      <div className="sectabs-inner" ref={innerRef}>
        {items.map(([label, id]) => (
          <button key={id} className={"sectab" + (active === id ? " on" : "")} aria-current={active === id ? "true" : undefined} onClick={() => go(id)}>{label}</button>
        ))}
      </div>
    </nav>
  );
}

/* ───────────────────────── SEPT 2026 BLOCKS ───────────────────────── */

/* 5-Night Watch banner (Addendum 01 §8.1, 03 §8.1). Members see where to continue instead. */
function TrialBand({ id }) {
  const { who } = useVisitor();
  const member = isMember(who);
  return (
    <div className="trialband reveal" id={id}>
      <div>
        <span className="tb-eyebrow">{member ? (who === "sub" || who === "peak" ? "Welcome back, Gut Guardian" : "Welcome back") : "The Gut Guardian movement"}</span>
        <h2 className="tb-h">{member ? <>Continue in your <em>Lifestyle page.</em></> : <>Join the movement and <em>become a Gut Guardian.</em></>}</h2>
        {member ? <p className="tb-line">Your card, E-Points, doses and plan are all in one place. Buy, refill or change your plan there.</p> : (<>
          <p className="tb-line">Chronic inflammation ages the body silently, for years before any symptom. Gut Guardians refuse to wait. We guard ourselves, our families and our communities, one watch at a time.</p>
          <div className="tb-creed"><span>Guard yourself</span><span>Guard your family</span><span>Guard your community</span></div>
          <p className="tb-sign">We Gut You.</p>
          <p className="tb-line tb-small">Your first watch is 5 nights. Start with the 5-Night Watch and a free Lifestyle card. The ₱499 comes off your first monthly plan.</p>
        </>)}
      </div>
      <div className="tb-side">
        {!member && <div className="tb-price">{peso(TRIAL_OFFER.price)}<small>Free shipping · new buyers</small></div>}
        <a className="tb-btn" {...linkTo(member ? (who === "trial" ? "#/shop?tab=subscribe" : memberUrl("member", who)) : "#/shop?start=watch")}>
          {member ? (who === "trial" ? "Continue your plan" : "Open my Lifestyle page") : "Start my 5 nights"} <ArrowRight size={15} />
        </a>
      </div>
    </div>
  );
}

/* Phases (Addendum 01 §8.3) */
function PhasesBlock() {
  return (
    <section className="section" style={{ paddingTop: 0 }}><div className="wrap">
      <div className="reveal">
        <h3 className="sub-h" id="phases">Repair → Calm → Regenerate</h3>
        <p className="sec-body" style={{ marginTop: 8 }}>One Peak pack completes the 90-Day Protocol with step-down.</p>
      </div>
      <div className="phase-cards reveal">
        {PHASES.map(([nm, wk, desc], i) => (
          <div className="phase-card" key={nm}>
            <span className="pc-n">Phase {i + 1}</span>
            <h3>{nm}</h3>
            <div className="pc-wk">{wk}</div>
            <p>{desc}</p>
          </div>
        ))}
      </div>
    </div></section>
  );
}

/* Find Your Dose + BioScan timeline (Addendum 01 §8.2, §8.4) */
function DoseBlock({ num = "05" }) {
  return (
    <section className="section" style={{ background: "var(--paper)", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)" }}><div className="wrap">
      <div className="reveal">
        <div className="sec-label" id="dose"><span className="num">{num}</span> Find your dose</div>
        <h2 className="sec">Your dose follows <em>your number.</em></h2>
        <p className="sec-body">Know your GLIS level. Take your dose. Check again at Day 30, 60 and 90. As your score goes down, your dose goes down.</p>
      </div>
      <div className="dose-cards reveal">
        {GOALS.map((g) => (
          <div className="dose-card" key={g.id}>
            <div className="dc-goal">{g.goal}</div>
            <div className="dc-day">{g.perDay} capsules a day</div>
            <div className="dc-row"><span>Reveille · morning, empty stomach</span><b>{g.rev}</b></div>
            {g.mid ? <div className="dc-row"><span>Midday · after lunch</span><b>{g.mid}</b></div> : null}
            <div className="dc-row"><span>Taps · before bedtime</span><b>{g.taps}</b></div>
            <div className="dc-meta">{g.level} · GLIS {g.glis}</div>
          </div>
        ))}
      </div>
      <p className="dose-note reveal">These are the recommended doses. You can adjust yours, and add a Midday dose, in Settings on your Lifestyle page. No GLIS result yet? Choose your goal. Not sure? Start with Keep healthy. Your BioScan at Day 30 sets your exact level.</p>
      <div className="reveal" style={{ marginTop: 40 }}>
        <h3 className="sub-h" id="bioscan-timeline">BioScan checkpoints <span className="bs-beta" style={{ verticalAlign: "middle", marginLeft: 8 }}>Beta</span></h3>
      </div>
      <div className="timeline reveal">
        {[["Day 30", "Your level is checked. Your dose is adjusted."], ["Day 60", "Your level is checked. Your dose is adjusted."], ["Day 90", "Your 90-day result."]].map(([d, t]) => (
          <div className="tl-item" key={d}><div className="tl-day">{d}</div><div className="tl-txt">{t}</div></div>
        ))}
      </div>
    </div></section>
  );
}

function About() {
  const who = [
    ["Prof. Roberto Malaluan, PhD", "Professor at MSU-IIT for 40 years; PhD in Chemical Engineering; research scientist for 25 years."],
    ["Engr. Rolly Racsa, PhD", "Bio-molecular scientist, MERAV."],
  ];
  return (
    <>
      <header className="hero">
        <div className="wrap"><div className="narrow reveal" style={{ maxWidth: 820 }}>
          <span className="eyebrow">About Gutguard</span>
          <h1>About <em>Gutguard.</em></h1>
          <p className="hero-lede"><strong>Gutguard Corporation is a science-backed Filipino biotech company building a platform for biological recovery.</strong> We help people measure how their body is recovering, then give them a system to improve it — and prove it with numbers.</p>
        </div></div>
      </header>
      <hr className="seam" />
      <section className="section"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="mission"><span className="num">01</span> Our mission</div>
          <p className="mission">To make longevity affordable, measurable and within reach of every Filipino family.</p>
        </div>
        <div className="reveal" style={{ marginTop: 56 }}>
          <div className="sec-label" id="what"><span className="num">02</span> What we do</div>
        </div>
        <div className="about-grid reveal">
          {[["The product", "SynBIOTIC+ — pre-, pro- and postbiotics in one capsule. 80 billion CFU, 17 strains, with Urolithin-A and L-Tryptophan."],
            ["The program", "The 90-Day Protocol: Repair → Calm → Regenerate, with the Gutguard Daily ritual from Taps to Reveille."],
            ["The proof", "BioScan tracking at Day 30, 60 and 90, scored by GLIS. MiAge biological age (Beta)."],
            ["The method", "Our Multi-Domain Integrated Biological Recovery Management System, under utility model application."]].map(([h, p]) => (
            <div className="about-card" key={h}><h3>{h}</h3><p>{p}</p></div>
          ))}
        </div>
        <div className="reveal" style={{ marginTop: 56 }}>
          <div className="sec-label" id="credentials"><span className="num">03</span> Credentials</div>
          <ul className="about-list">
            {["FDA-registered: CPR No. FR-40000015571456, LTO No. LTO-30000007262499", "USAID-funded research program", "Manufactured with MERAV, an ISO-certified bio-molecular manufacturer", "Research partnership with MSU-IIT under MOU, and three other academic institutions", "20 branches nationwide, with online, branch and direct-selling channels"].map((t) => <li key={t}><Check size={16} />{t}</li>)}
          </ul>
        </div>
        <div className="reveal" style={{ marginTop: 56 }}>
          <div className="sec-label" id="people"><span className="num">04</span> People</div>
          <div className="person"><b>Col. Shane Animas (Ret.) — Founder, Chairman and CEO</b><span>A soldier by profession, with 26 years in the Philippine Army. US-trained and specialized in investigation and information science. Holds a Master's in Entrepreneurship from Ateneo de Manila University. He built Gutguard on one principle: if it cannot be measured, it cannot be trusted.</span></div>
          <h3 className="sub-h" style={{ marginTop: 34, fontSize: 22 }}>Scientific Advisory Board</h3>
          {who.map(([n, d]) => <div className="person" key={n}><b>{n}</b><span>{d}</span></div>)}
          <h3 className="sub-h" style={{ marginTop: 34, fontSize: 22 }}>Medical Advisory Board</h3>
          <div className="person"><b>Dr. Joey Sinchioco</b><span>Medical Director.</span></div>
          <h3 className="sub-h" style={{ marginTop: 34, fontSize: 22 }}>Clinical and research partners</h3>
          <div className="person"><b>Beehive Brain Developmental Center</b><span>Clinical Investigator for the Gutguard–Beehive Early Intervention Program for Children with Autism Spectrum Disorder (ASD). Led by Dr. Grace Saraza, PhD.</span></div>
          <div className="person"><b>Brain Capital Corp</b><span>Mental wellness and brain health partner. Led by Rob Rances, PhD.</span></div>
          <h3 className="sub-h" style={{ marginTop: 34, fontSize: 22 }}>Technology</h3>
          <div className="person"><b>Jesher Charles Dlonsod</b><span>Chief Technology Officer.</span></div>
        </div>
      </div></section>
      <FinalCTA label="Gutguard Corporation" title={<>Know your number. <em>Start your recovery.</em></>} body="New here? Begin with five nights and a free Lifestyle card." cta="Start my 5 nights" href={"#/shop?start=watch"} external />
    </>
  );
}

function Legal() {
  return (
    <>
      <header className="hero">
        <div className="wrap"><div className="narrow reveal" style={{ maxWidth: 760 }}>
          <span className="eyebrow">Legal</span>
          <h1>Terms and <em>privacy.</em></h1>
          <p className="hero-lede">Gutguard Corporation. The full texts are published here before launch.</p>
        </div></div>
      </header>
      <hr className="seam" />
      <section className="section"><div className="wrap">
        <ul className="legal-list reveal">
          {[["Terms of Sale", "Prices, delivery, the ₱499 5-Night Watch (new buyers, or no order in the last 12 months; one per mobile number) and returns."],
            ["Subscription Terms", "Gutguard Daily renews every month or every 3 months until you cancel. Change, skip, pause or cancel anytime in your Lifestyle page."],
            ["Refund Policy", "How to return an item and get your money back."],
            ["Privacy Notice", "How we collect, use and protect your data under the Data Privacy Act (RA 10173)."]].map(([h, d]) => (
            <li key={h}><b>{h}</b><span>{d} <em>Full text from legal counsel — to be added.</em></span></li>
          ))}
        </ul>
      </div></section>
    </>
  );
}

/* Sticky footer offer — four states (Addendum 02 §3, free shipping per 03 §8.1) */
function FooterOffer({ route }) {
  const { who } = useVisitor();
  const [shown, setShown] = useState(false);
  const enabled = route === "/"; /* /shop has its own buy bar */
  useEffect(() => {
    if (!enabled) { setShown(false); return; }
    let anchorPassed = false;
    const ends = new Set();
    const update = () => setShown(anchorPassed && ends.size === 0);
    const onScroll = () => { anchorPassed = window.scrollY > Math.min(560, window.innerHeight * 0.6); update(); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const eObs = new IntersectionObserver(
      (entries) => { entries.forEach((e) => { e.isIntersecting ? ends.add(e.target) : ends.delete(e.target); }); update(); },
      { threshold: 0 }
    );
    document.querySelectorAll("footer, .final").forEach((el) => eObs.observe(el));
    return () => { window.removeEventListener("scroll", onScroll); eObs.disconnect(); };
  }, [route, enabled]);
  if (!enabled) return null;
  const S = {
    guest: { tag: "First purchase · free shipping", name: "5-Night Watch + free Lifestyle Membership", amt: peso(TRIAL_OFFER.price), sub: "5 nights · 10 capsules", cta: "Start my 5 nights", href: "#/shop?start=watch" },
    trial: { tag: "Lifestyle member", name: "Your ₱499 credit is ready", amt: "₱499 off", sub: "your first monthly order", cta: "Continue your plan", href: "#/shop?tab=subscribe" },
    sub:   { tag: "Gutguard Daily", name: "Next refill 17 Oct", amt: "15", sub: "E-Points", cta: "My Lifestyle", href: memberUrl("member", who) },
    peak:  { tag: "90-Day Protocol", name: "Day 12 of 90", amt: "33", sub: "E-Points", cta: "My Lifestyle", href: memberUrl("member", who) },
  }[who];
  return (
    <div className={"buybar" + (shown ? " show" : "")} role="region" aria-label={S.name} aria-hidden={!shown}>
      <div className="buybar-inner">
        <div className="bb-info">
          <span className="bb-tag">{S.tag}</span>
          <span className="bb-name">{S.name}</span>
        </div>
        <div className="bb-price">
          <span className="bb-amt">{S.amt}</span>
          <span className="bb-sub">{S.sub}</span>
        </div>
        {who === "guest" && <a className="bb-skip" href="#/shop?tab=subscribe" tabIndex={shown ? 0 : -1}>Skip the trial, start my plan</a>}
        <a className="btn-primary bb-cta" {...linkTo(S.href)} tabIndex={shown ? 0 : -1}>{S.cta} <Arrow /></a>
      </div>
    </div>
  );
}

/* Demo only — switch the visitor state to see each footer and button. Remove in production. */
function DemoChip() {
  const { who, setWho, failNext, setFailNext, usedBefore, setUsedBefore } = useVisitor();
  const [open, setOpen] = useState(false);
  return (
    <div className="demo-chip" aria-label="Demo controls">
      {open && <label style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 8, cursor: "pointer" }}><input type="checkbox" checked={failNext} onChange={(e) => setFailNext(e.target.checked)} /> Next payment fails</label>}
      {open && <label style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 8, cursor: "pointer" }}><input type="checkbox" checked={usedBefore} onChange={(e) => setUsedBefore(e.target.checked)} /> Mobile ordered in last 12 months</label>}
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{ color: "inherit", fontFamily: "inherit", fontSize: "inherit", letterSpacing: "inherit" }}>DEMO{open ? " ▾" : " ▸"}</button>
      {open && <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Visitor state">
        {VISITORS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>}
    </div>
  );
}

export default function GutguardSite() {
  const [route, setRoute] = useState(() => normHash(window.location.hash));
  const [who, setWho] = useState(() => { const m = (normHash(window.location.hash).match(/[?&]who=(\w+)/) || [])[1]; return VISITORS.some(([k]) => k === m) ? m : "guest"; });
  const [failNext, setFailNext] = useState(false);
  const [usedBefore, setUsedBefore] = useState(false); /* demo: this mobile number has ordered before */
  const [navKey, setNavKey] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const mainRef = useRef(null);
  const sheetRef = useRef(null);
  const burgerRef = useRef(null);
  const pendingScrollRef = useRef(null);

  /* hash routing */
  useEffect(() => {
    const onHash = () => setRoute(normHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  /* nav shadow */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* route change → top (or pending section) + move focus to main (announces new page to AT) */
  useEffect(() => {
    setOpen(false);
    const pend = pendingScrollRef.current;
    pendingScrollRef.current = null;
    if (pend) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = document.getElementById(pend);
        if (el) { const y = el.getBoundingClientRect().top + window.scrollY - 116; window.scrollTo(0, y < 0 ? 0 : y); }
        else window.scrollTo(0, 0);
      }));
    } else {
      window.scrollTo(0, 0);
    }
    const m = mainRef.current;
    if (m) m.focus({ preventScroll: true });
  }, [route]);

  /* body scroll lock while menu open */
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; }, [open]);
  /* When a field is tapped, wait for the phone keyboard, then bring the field into view */
  useEffect(() => {
    const on = (e) => { const el = e.target; if (!el || !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.type === "checkbox" || el.type === "radio") return; setTimeout(() => bringIntoView(el), 320); };
    document.addEventListener("focusin", on); return () => document.removeEventListener("focusin", on);
  }, []);

  /* focus trap for the mobile dialog: focus in, Esc closes, Tab cycles, focus restored */
  useEffect(() => {
    if (!open) return;
    const prev = burgerRef.current;
    const cont = sheetRef.current;
    const q = () => Array.from(cont.querySelectorAll('a[href],button:not([disabled])')).filter((n) => n.offsetParent !== null);
    requestAnimationFrame(() => { const f = q()[0]; if (f) f.focus(); });
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
      if (e.key !== "Tab") return;
      const nodes = q(); if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); if (prev) prev.focus(); };
  }, [open]);

  useReveal(route);

  /* reliable in-app navigation: intercept internal links instead of trusting hashchange */
  const handleNavClick = (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#/"]');
    if (!a) return;
    e.preventDefault();
    const to = a.getAttribute("href").slice(1);
    setRoute(to); setNavKey((k) => k + 1);
    try { window.history.replaceState(null, "", "#" + to); } catch (err) {}
  };

  const [path, qs] = route.split("?");
  const params = Object.fromEntries(new URLSearchParams(qs || ""));
  params._k = navKey + "|" + (qs || "");
  useEffect(() => { if (params.who && VISITORS.some(([k]) => k === params.who)) setWho(params.who); }, [qs]);
  const Page = ROUTES[path] || Home;

  /* jump to a section — scroll if already on the page, else navigate then scroll */
  const goTo = (targetRoute, id) => {
    if (targetRoute === route) {
      const el = document.getElementById(id);
      if (el) { const y = el.getBoundingClientRect().top + window.scrollY - 116; window.scrollTo({ top: y < 0 ? 0 : y, behavior: "smooth" }); }
    } else {
      pendingScrollRef.current = id;
      setRoute(targetRoute);
      try { window.history.replaceState(null, "", "#" + targetRoute); } catch (err) {}
    }
  };

  return (
    <VisitorCtx.Provider value={{ who, setWho, failNext, setFailNext, usedBefore, setUsedBefore }}>
    <div className="gg" onClick={handleNavClick}>
      <style>{CSS}</style>
      <a className="skip" href="#main">Skip to content</a>
      <Nav route={path} scrolled={scrolled} open={open} setOpen={setOpen} sheetRef={sheetRef} burgerRef={burgerRef} />
      {SECTIONS[path] && <SectionTabs key={path} items={SECTIONS[path]} />}
      <main id="main" ref={mainRef} tabIndex={-1}>
        <Page params={params} />
      </main>
      <Footer route={path} goTo={goTo} />
      <FooterOffer route={path} />
      <DemoChip />
    </div>
    </VisitorCtx.Provider>
  );
}
