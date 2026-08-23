"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Menu, X, Check, Lock } from "lucide-react";
import { TIERS } from "@/lib/catalog";

/* ────────────────────────────────────────────────────────────
   Gutguard — Multi-page site (Home · Science · Shop · Physicians)
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
.gg [id]{scroll-margin-top:150px;}
:where(.gg a){color:inherit;text-decoration:none;}
:where(.gg button){font-family:inherit;cursor:pointer;border:0;background:0;color:inherit;}
.gg img{max-width:100%;display:block;}
.gg :focus-visible{outline:2px solid var(--blue);outline-offset:3px;border-radius:3px;}
.gg .measure :focus-visible,.gg .final :focus-visible,.gg .lca-hero.dark :focus-visible,.gg .rationale :focus-visible{outline-color:#F4F1EA;}
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

.bs-beta{display:inline-flex;align-items:center;gap:5px;font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;padding:2px 8px;border-radius:100px;border:1px dashed var(--gold-text);color:var(--gold-text);white-space:nowrap;}
.bs-beta::before{content:'';width:4px;height:4px;border-radius:50%;background:currentColor;flex-shrink:0;}
.bs-foot{margin-top:16px;padding-top:12px;border-top:1px solid var(--rule);display:flex;flex-direction:column;gap:3px;}
.bs-foot .bs-lc{font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-text);}
.bs-foot .bs-lc b{font-weight:700;}
.bs-foot .bs-sample{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-4);}

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
.sec-flag{display:inline-flex;align-items:center;gap:6px;font-family:var(--mono);font-size:9.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:3px 9px;border-radius:100px;border:1px dashed var(--gold-soft);color:var(--gold-soft);margin-left:auto;}
.sec-flag::before{content:'';width:5px;height:5px;border-radius:50%;background:currentColor;flex-shrink:0;}
.sec-flag.lt{border-color:var(--gold-text);color:var(--gold-text);}
.beta-tag.lt{border-color:var(--gold-text);color:var(--gold-text);}
@media(max-width:560px){.sec-label{flex-wrap:wrap;}.sec-flag{margin-left:0;}}
.sec-h-beta{font-family:var(--mono);font-size:.34em;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:3px 9px;border-radius:100px;border:1px solid var(--gold-soft);color:var(--gold-soft);vertical-align:middle;margin-left:12px;white-space:nowrap;}
.sec-h-beta.lt{border-color:var(--gold-text);color:var(--gold-text);}
/* reusable card flag for any surface showing MiAge */
.beta-tag{display:inline-flex;align-items:center;gap:5px;font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;padding:2px 8px;border-radius:100px;border:1px dashed var(--gold-soft);color:var(--gold-soft);white-space:nowrap;}
.beta-tag::before{content:'';width:4px;height:4px;border-radius:50%;background:var(--gold-soft);flex-shrink:0;}
.beta-tag.blk{display:flex;width:max-content;margin-top:10px;}
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
.mh-pair{display:flex;align-items:baseline;gap:clamp(10px,2vw,18px);flex-wrap:wrap;margin:12px 0 6px;}
.mh-real{font-family:var(--serif);font-size:clamp(34px,6vw,56px);line-height:.9;letter-spacing:-.03em;color:var(--slate-mut);}
.mh-pair .mh-num{margin:0;}
.mh-arrow{font-family:var(--mono);font-size:clamp(20px,3vw,30px);color:var(--gold-soft);line-height:1;align-self:center;}
.mh-legend{display:flex;align-items:baseline;gap:clamp(10px,2vw,18px);flex-wrap:wrap;font-family:var(--mono);font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--slate-mut);}
.mh-legend b{font-weight:600;color:var(--gold-soft);}
.mh-say{font-family:var(--serif);font-size:clamp(17px,2.1vw,20px);color:#EAF1F0;margin:16px 0 0;line-height:1.4;}
.mh-eg{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--slate-mut);margin-top:8px;}
.mh-count{display:flex;align-items:center;gap:18px;margin-top:22px;border:1px solid var(--slate-line);border-radius:14px;padding:16px 20px;background:rgba(201,172,126,.06);}
.mh-count-n{font-family:var(--serif);font-size:clamp(38px,6vw,58px);line-height:.9;letter-spacing:-.03em;color:var(--gold-soft);min-width:1.6ch;text-align:center;}
.mh-count-t{display:flex;flex-direction:column;gap:4px;min-width:0;}
.mh-count-t b{font-family:var(--mono);font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#EAF1F0;}
.mh-count-t span{font-size:12.5px;line-height:1.5;color:#B8C6D6;}
.mh-betaline{margin-top:20px;border-left:2px solid var(--gold-soft);padding:10px 0 10px 14px;font-size:13px;line-height:1.55;color:#B8C6D6;}
.mh-betaline b{color:var(--gold-soft);font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;display:block;margin-bottom:4px;font-weight:700;}
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
/* Story of Hope — felt-result testimonial (no scores; MiAge withheld pending study) */
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

.soh-long{font-family:var(--serif);font-style:italic;font-size:18px;color:var(--ink-2);margin:20px 0 0;}
.soh-caveat{font-family:var(--mono);font-size:11.5px;color:var(--ink-4);margin-top:20px;border-top:1px solid var(--rule);padding-top:16px;line-height:1.5;}
/* felt-result timeline — subjective, member-reported, no scores */
.soh-felt{margin:28px 0 0;display:flex;flex-direction:column;}
.soh-fr{display:flex;gap:18px;padding:16px 0;border-top:1px solid var(--rule);align-items:flex-start;}
.soh-fr:first-child{border-top:none;padding-top:0;}
.soh-wk{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-text);white-space:nowrap;padding-top:5px;min-width:66px;}
.soh-ft{font-family:var(--serif);font-size:clamp(18px,2.4vw,22px);line-height:1.35;color:var(--ink);margin:0;font-style:italic;}
.soh-fs{font-family:var(--mono);font-size:12px;color:var(--ink-3);margin-top:5px;}
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
.rationale .sec-label{color:var(--slate-mut);}.rationale .sec-label::before{background:var(--slate-mut);}
.rationale .sec-label .num{color:var(--recovery);}
.rationale h2.sec em{color:var(--gold-soft);}
.rationale .layer{grid-template-columns:104px 1fr;align-items:flex-start;}
.rationale .lyr-tag{color:var(--gold-text);}
@media(max-width:680px){.rationale .layer{grid-template-columns:1fr;}}
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
.co-nx.soon{opacity:.72;}
.co-nx-soon{display:inline-block;font-family:var(--mono);font-size:9.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:2px 7px;margin-left:8px;border-radius:100px;border:1px dashed var(--ink-4);color:var(--ink-4);vertical-align:middle;}

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

/* navigation / purchase / footer redesign */
.nav{transition:border-color .22s,box-shadow .22s,background .22s;}
.nav.scrolled{background:rgba(244,241,234,.96);border-bottom-color:rgba(20,16,25,.12);box-shadow:0 5px 14px rgba(20,16,25,.055);}
.nav-inner{display:grid;grid-template-columns:minmax(150px,1fr) auto minmax(250px,1fr);align-items:center;justify-content:normal;column-gap:clamp(20px,3vw,44px);padding-block:12px;transition:padding .2s var(--ease);}
.nav.scrolled .nav-inner{padding-block:9px;}
.nav-lead{justify-self:start;}
.nav-links{gap:clamp(14px,1.7vw,25px);}
.nav-links a{font-size:14px;font-weight:600;min-height:44px;display:inline-flex;align-items:center;}
.nav-links a[aria-current="page"]::after{height:2px;bottom:0;background:var(--blue);}
.nav-actions{justify-self:end;display:flex;align-items:center;gap:14px;white-space:nowrap;}
.nav-login{min-height:44px;padding:8px 4px;border:0;color:var(--ink-3);font-size:13px;font-weight:550;}
.nav-login:hover{color:var(--blue);}
.gg .nav-cta{min-height:44px;padding:10px 16px;background:var(--blue);color:var(--bone);white-space:nowrap;}
.gg .nav-cta:hover{background:var(--blue-press);}
.nav-shop-mobile{display:none;min-width:44px;min-height:44px;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--blue);}
.sheet .nav-cta{background:var(--blue);color:var(--bone);border-bottom:0;}
.sheet .sheet-login{margin-top:auto;padding-top:24px;}

.sectabs-inner{padding-block:7px;}
.sectab{font-family:var(--sans);font-size:13px;font-weight:650;letter-spacing:0;text-transform:none;min-height:44px;padding:9px 16px;}
.sectab.on{background:rgba(6,8,169,.08);border-color:rgba(6,8,169,.42);color:var(--blue);box-shadow:inset 0 -2px 0 var(--blue);}

.gg:has(.buybar.show){padding-bottom:calc(80px + env(safe-area-inset-bottom));}
.buybar{transition:transform .26s var(--ease);box-shadow:0 -12px 34px rgba(20,16,25,.12);}
.buybar-inner{min-height:76px;padding-block:8px;}
.bb-thumb{width:50px;height:58px;display:flex;align-items:center;justify-content:center;border:1px solid var(--rule);border-radius:10px;background:var(--bone);overflow:hidden;flex:none;}
.bb-thumb img{width:38px;height:52px;object-fit:contain;}
.bb-info{gap:5px;}
.bb-name{font-size:19px;}
.bb-meta{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ink-3);white-space:nowrap;}
.bb-tag{display:inline-flex;align-items:center;min-height:22px;padding:3px 8px;border:1px solid var(--gold-soft);border-radius:999px;background:var(--gold-pale);font-size:9px;color:var(--gold-text);}
.bb-price{gap:4px;min-width:126px;}
.bb-amt{font-size:22px;}
.bb-sub{font-size:11px;}
.bb-cta{min-height:48px;background:var(--blue);}

.science-standard.section{padding:clamp(40px,5vw,50px) 0 clamp(38px,4vw,45px);}
.science-standard h2.sec{max-width:24ch;}
.science-standard .sec-body{max-width:640px;font-size:17px;line-height:1.65;}
.trust{padding:24px 0 27px;border-top:1px solid var(--rule);border-bottom:0;background:var(--bone);}
.trust-label{margin-bottom:24px;font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2);}
.trust-grid{gap:0;}
.trust-item{padding:4px 20px 2px;border-left:1px solid var(--rule);}
.trust-item:first-child{border-left:0;}
.trust-item .l{font-size:10.5px;color:var(--ink-2);}
.compliance-strip{padding:0;background:var(--paper);border:0;border-top:2px solid rgba(176,141,91,.45);}
.compliance{max-width:920px;margin:0 auto;padding:12px 0;border:0;border-radius:0;box-shadow:none;background:transparent;grid-template-columns:auto minmax(0,760px);justify-content:center;align-items:center;gap:18px;}
.comp-seal{width:48px;height:48px;}
.comp-txt{display:block;max-width:680px;}
.comp-txt h3{font-size:18px;margin:0 0 3px;}
.comp-txt .b{font-size:15px;line-height:1.55;color:var(--ink-2);}
.site-footer{padding:0;background:var(--bone-soft);border-top:1px solid rgba(20,16,25,.12);}
.footer-main{display:grid;grid-template-columns:minmax(210px,.8fr) minmax(0,2.2fr);align-items:start;gap:clamp(36px,5vw,72px);padding:24px 0 44px;}
.footer-brand p{max-width:28ch;margin-top:14px;font-size:15px;line-height:1.55;color:var(--ink-2);}
.footer-groups{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr) minmax(0,.72fr) minmax(0,1.35fr);align-items:start;gap:clamp(20px,3vw,42px);}
.footer-group{align-self:start;min-width:0;}
.footer-group-toggle{width:100%;min-height:34px;display:flex;align-items:center;justify-content:space-between;background:none;border:0;text-align:left;font-family:var(--serif);font-size:17px;font-weight:600;color:var(--ink);cursor:default;}
.footer-group-toggle span{display:none;}
.footer-group ul{list-style:none;display:flex;flex-direction:column;gap:2px;margin-top:6px;}
.footer-group a{display:inline-flex;align-items:center;min-height:32px;font-size:14px;color:var(--ink-2);text-decoration:underline;text-decoration-color:transparent;text-underline-offset:4px;}
.footer-group a:hover,.footer-group a:focus-visible{color:var(--blue);text-decoration-color:currentColor;}
.footer-legal{border-top:1px solid var(--rule);padding:22px 0 30px;display:flex;justify-content:space-between;gap:14px 28px;flex-wrap:wrap;font-family:var(--mono);font-size:12px;line-height:1.6;color:var(--ink-2);}
.gg a:focus-visible,.gg button:focus-visible{outline:3px solid var(--gold);outline-offset:3px;}

@media(max-width:1080px){
  .nav-inner{grid-template-columns:minmax(125px,1fr) auto minmax(225px,1fr);column-gap:18px}
  .nav-links{gap:11px}.nav-links a{font-size:12.5px}.nav-actions{gap:9px}.nav-login{padding-inline:2px}.gg .nav-cta{padding-inline:13px;font-size:12.5px}
}
@media(max-width:860px){
  .nav-inner{display:flex;min-height:0;padding-block:10px}.nav.scrolled .nav-inner{padding-block:8px}
  .nav-actions{display:none}
  .nav-shop-mobile{display:inline-flex;margin-left:auto}.burger{flex:none}.nav-here{display:none}
  .sheet a{min-height:52px;display:flex;align-items:center}.sheet .nav-cta{min-height:52px}
  .footer-main{grid-template-columns:1fr;gap:22px;padding:24px 0 44px}.footer-groups{grid-template-columns:1fr;gap:0;border-top:1px solid var(--rule)}
  .footer-group{border-bottom:1px solid var(--rule)}.footer-group-toggle{cursor:pointer;font-size:16px}
  .footer-group-toggle span{display:block;font-family:var(--sans);font-size:22px;font-weight:400;transition:transform .2s}
  .footer-group.open .footer-group-toggle span{transform:rotate(45deg)}
  .footer-group ul{display:none;padding:0 0 14px}.footer-group.open ul{display:flex}
  .footer-group-toggle,.footer-group a{min-height:44px}.footer-legal{flex-direction:column;align-items:flex-start;font-size:12px}
  .trust-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:22px 0;text-align:left}
  .trust-item,.trust-item:first-child{border-left:1px solid var(--rule);padding-inline:18px}
  .trust-item:nth-child(3n+1){border-left:0;padding-left:0}
}
@media(max-width:700px){
  .compliance{max-width:none;margin:0;grid-template-columns:auto 1fr;justify-content:start;padding:12px 0}.comp-txt{display:block}.comp-txt h3{margin-bottom:3px}
}
@media(max-width:600px){
  .trust{padding:24px 0 27px}.trust-label{margin-bottom:20px}
  .trust-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:24px 0}
  .trust-item,.trust-item:first-child,.trust-item:nth-child(3n+1){min-width:0;border-left:1px solid var(--rule);padding:2px 14px}
  .trust-item:nth-child(odd){border-left:0;padding-left:0}
  .trust-item:last-child{grid-column:auto}
  .trust-item .n{font-size:26px}.trust-item .l{font-size:10px;letter-spacing:.035em}
  .compliance{grid-template-columns:44px minmax(0,1fr);gap:14px}.comp-seal{width:44px;height:44px}.comp-txt .b{font-size:14px}
}
@media(max-width:620px){
  .gg:has(.buybar.show){padding-bottom:calc(78px + env(safe-area-inset-bottom));}
  .buybar-inner{min-height:74px;gap:9px;padding-inline:12px}.bb-thumb{display:none}.bb-info{display:flex;flex:1;min-width:0}.bb-name{font-size:15px}.bb-meta{font-size:10px}.bb-tag{display:none}
  .bb-price{margin-left:0;min-width:auto;text-align:right}.bb-amt{font-size:17px}.bb-sub{font-size:9px;white-space:nowrap}.bb-cta{padding:10px 13px;font-size:12px;min-height:44px}.bb-cta .arr{display:none}
}
@media(max-height:520px) and (orientation:landscape){
  .buybar-inner{min-height:58px;padding-block:5px}.bb-thumb{display:none}.bb-meta{display:none}.bb-cta{min-height:44px}
}
@media(prefers-reduced-motion:reduce){
  .gg *{animation:none!important;transition:none!important;}
  .reveal{opacity:1;transform:none;}
  .bs-fill{width:var(--w)!important;}
  .traj-svg polyline{stroke-dashoffset:0!important;}
  .sheet,.buybar,.sectabs{transition:none!important;}
}
`;

const NAV = [
  ["Why GutGuard", "/#why-now"],
  ["How It Works", "/system"],
  ["Science", "/science"],
  ["Shop", "/shop"],
  ["For Physicians", "/physicians"],
];
const APP_URL = "https://app.gutguard.ph"; /* BioScan / GLIS app — the logged-in product surface */

/* ── MiAge launch ────────────────────────────────────────────────
   SINGLE SOURCE OF TRUTH for every countdown on the site.
   Set to the date MiAge goes live to members. ISO, local midnight.
   Remove the countdown entirely by setting this to null.
   ⚠ PLACEHOLDER — confirm before ship.                          */
/* Inline flag used on every surface that shows MiAge.
   variant: "sec" (section eyebrow) | "tag" (card) ; lt = light background */
function BetaFlag({ variant = "tag", lt = false, block = false }) {
  const cls = (variant === "sec" ? "sec-flag" : "beta-tag") + (lt ? " lt" : "") + (block ? " blk" : "");
  return <span className={cls}>Beta · In validation</span>;
}

/* Compact launch text — tight surfaces (hero readout card) */
function LaunchNote() {
  return <>Currently in <b>beta</b></>;
}

/* Large countdown block — dark surfaces (MiAge hero) */
function LaunchCountdown() {
  return (
    <div className="mh-count">
      <div className="mh-count-n">β</div>
      <div className="mh-count-t">
        <b>MiAge validation is underway</b>
        <span>No public launch date has been announced.</span>
      </div>
    </div>
  );
}
const GG_LOGO = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNTAzIDM0NCIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJHdXRndWFyZCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImdnTW9sZWN1bGUiIHgxPSIwLjE1IiB5MT0iMCIgeDI9IjAuNyIgeTI9IjEiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiMyNjI2REQiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMDcwNzc0Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgwLjAwMDAwMCwzNDQuMDAwMDAwKSBzY2FsZSgwLjEwMDAwMCwtMC4xMDAwMDApIiBmaWxsPSIjMTQxMDE5IiBzdHJva2U9Im5vbmUiPjxwYXRoIGQ9Ik0xNDI5NyAyOTYzIGMtNCAtMyAtNyAtMjE4IC03IC00NzcgMCAtMjU5IC00IC00NzcgLTkgLTQ4NCAtNiAtMTAKLTEyIC04IC0yMyAxMCAtNDYgNjggLTE3MSAxNzEgLTI1OSAyMTIgLTE0MSA2NiAtMzkyIDg3IC01NDkgNDYgLTMwNiAtNzkKLTUxNyAtMjk3IC01OTEgLTYxMCAtMTYgLTY5IC0xNiAtMzQ2IDAgLTQxNSA5NiAtNDEwIDQ0MyAtNjYxIDg3MSAtNjMwIDIyMAoxNiAzOTQgMTEwIDUzNyAyOTAgbDMyIDQwIDAgLTE1MiBjMSAtMTc5IC01IC0xNzAgMTE4IC0xNjMgbDg4IDUgMyAxMTU5IGMyCjkyMSAwIDExNjEgLTEwIDExNjggLTE2IDkgLTE5MiAxMSAtMjAxIDF6IG0tNDk0IC04NzQgYzI0MiAtMzcgNDQ0IC0yNTAgNDc4Ci01MDQgNTIgLTM5NSAtMTMyIC02OTIgLTQ3NCAtNzY2IC0xMTMgLTI0IC0xNDEgLTI0IC0yNTUgMSAtMTMzIDI4IC0yMTIgNzAKLTMwMyAxNjAgLTg1IDg1IC0xMTUgMTM0IC0xNTQgMjUwIC0zNyAxMTEgLTM5IDMyNSAtNSA0MzUgMTAwIDMxOCAzNjggNDc3CjcxMyA0MjR6Ii8+CjxwYXRoIGQ9Ik0xNDcwNSAyOTQ2IGMtMTU2IC03MCAtMTU3IC0yODAgLTEgLTM1MiA2MCAtMjggNzYgLTI5IDEzNiAtOCAxNjUKNTcgMTc3IDI5MiAxNyAzNTkgLTQ0IDE4IC0xMTIgMTkgLTE1MiAxeiBtMTYyIC0yNyBjODAgLTQ5IDEwOCAtMTQyIDY4IC0yMjIKLTg3IC0xNzUgLTMzNSAtMTEwIC0zMjMgODQgOSAxMjcgMTQ5IDIwMyAyNTUgMTM4eiIvPgo8cGF0aCBkPSJNMTQ3MTcgMjg2MyBjLTE1IC0xNSAtOCAtMTkzIDggLTE5MyAxMyAwIDIwIDE5IDE2IDQ0IC0yIDExIDE5IDM2CjMwIDM2IDUgMCAyMCAtMTggMzQgLTQwIDM1IC01NSA2MyAtNTYgMzUgLTEgLTE3IDM1IC0xOCA0MSAtNSA1NSAyMyAyMiAxOSA3MgotNyA5MCAtMjIgMTYgLTk5IDIyIC0xMTEgOXogbTkxIC0yNSBjMjEgLTIxIDE0IC01NyAtMTIgLTY0IC0zMyAtOCAtNDYgMiAtNDYKMzUgMCA0MSAzMCA1NyA1OCAyOXoiLz4KPHBhdGggZD0iTTExMTAgMjg2NCBjLTQzNCAtNTUgLTc3OCAtMjkxIC05NDUgLTY0OCAtMTkgLTQxIC0zNSAtODAgLTM1IC04NiAwCi02IC00IC0xOCAtOSAtMjggLTkgLTE3IC0xNyAtNDYgLTQyIC0xNTIgLTE4IC03MyAtMTggLTM3OCAtMSAtNDQ1IDQwIC0xNTMKNTkgLTIxMCAxMDMgLTI5OCAxNTUgLTMwOCA0MzIgLTUxNiA4MDUgLTYwNCAxMjYgLTI5IDQ3MiAtMjYgNjE0IDUgMjU3IDU4CjU2OSAyMDAgNTg2IDI2NiAyIDEyIDMgMjE1IDIgNDUxIGwtMyA0MzAgLTIzNSAwIC0yMzUgMCAtMyAtMzI2IC0yIC0zMjcgLTY1Ci0yNiBjLTI2OSAtMTA4IC01NzEgLTc3IC03OTEgNzkgLTI2MiAxODggLTM0OSA1OTUgLTE5NCA5MTAgMjAzIDQxMiA3OTcgNTAzCjExNzQgMTgwIDYzIC01MyA2MSAtNTMgMTA3IC0xMiAxMDYgOTQgMjc0IDI1MSAyNzcgMjU3IDQgMTEgLTEzMSAxMzUgLTE5OQoxODAgLTEyNiA4NiAtMzE4IDE2MSAtNDYzIDE4MCAtNDQgNiAtMTExIDE1IC0xNDggMjEgLTg1IDEyIC0xNjYgMTAgLTI5OCAtN3oiLz4KPHBhdGggZD0iTTQ4NzkgMjY3OCBjLTEgLTEzIDAgLTEwMiAxIC0xOTkgMSAtMTM5IC0xIC0xNzggLTEyIC0xODcgLTkgLTcgLTYyCi0xMiAtMTM0IC0xNCBsLTExOSAtMyAwIC0xODAgMCAtMTgwIDEyMCAtMyBjOTggLTIgMTIyIC01IDEzMyAtMTkgOSAtMTMgMTIKLTExMiAxMiAtNDE1IDAgLTQ0MyA0IC00NzcgNzEgLTYxMSA2MiAtMTIxIDIxMCAtMjI1IDM2OSAtMjU4IDk0IC0yMCAzMTggLTE3CjQwMCA1IDg1IDIzIDE3NyA2NCAxODQgODMgOCAxOSAtMTE1IDMzMyAtMTI5IDMzMyAtNyAwIC0yNiAtNyAtNDQgLTE2IC0xNyAtOAotNTkgLTIwIC05NCAtMjUgLTEzNCAtMTkgLTIyMCAyNSAtMjU2IDEzMCAtMTMgMzkgLTE2IDc1OCAtMyA3NzggNiA5IDY0IDEzCjIxMiAxNSBsMjA1IDMgMCAxODAgMCAxODAgLTIxMCA1IC0yMTAgNSAtMyAyMDggLTIgMjA3IC0yNDUgMCAtMjQ1IDAgLTEgLTIyeiIvPgo8cGF0aCBkPSJNNzE0NSAyMzU0IGMtMTM5IC0xOSAtMTg2IC0zMCAtMjYxIC01OSAtMjIwIC04NiAtMjMxIC0xMzYgLTM2IC0xNzEKNjEgLTExIDgzIC0xMSAxNTAgMiAxNjQgMzIgMjAwIDM1IDMwNyAzMCAyODkgLTE0IDUwOSAtMTgyIDU4MiAtNDQyIDI0IC04NQoyNCAtMjgwIDAgLTM1OSAtOTQgLTMxMCAtMzc1IC00ODQgLTcyMCAtNDQ1IC0yNjUgMzAgLTQ0OCAxNzcgLTUzNyA0MzAgLTggMjAKLTE0IDEwNiAtMTcgMjA1IC0yIDExMSAtOSAxODcgLTE5IDIyMCAtMTcgNTggLTg1IDE4NyAtMTAwIDE5MiAtMTUgNSAtNjgKLTEwOCAtODcgLTE4MyAtMzUgLTEzOCAtNDIgLTIwOSAtMjkgLTMyMiA0MiAtMzY4IDI0OSAtNjEyIDYwOSAtNzE5IDEyOCAtMzgKMzY3IC0zOCA0ODkgMCAxNjEgNTAgMjU1IDEwNyAzNTMgMjEzIDM0IDM3IDY0IDY1IDY3IDYyIDEyIC0xMyA0IC0zMDYgLTExCi0zODEgLTU4IC0zMDMgLTIzOSAtNDMyIC02MTAgLTQzMiAtMjUzIDAgLTQwNyA0MyAtNTk2IDE2NiAtNDEgMjcgLTc5IDQ5IC04NQo0OSAtNSAwIC0zMiAtMzUgLTYxIC03NyAtNDggLTc0IC01MCAtNzkgLTM1IC05NyA0NSAtNTEgMjIxIC0xNDYgMzIyIC0xNzUgMjUKLTcgNTYgLTE3IDcwIC0yMSA5MiAtMzAgMTQ2IC0zNSAzODUgLTM1IDI1MSAwIDI3MSAyIDM5MyA0MSAxNjYgNTQgMzA3IDE4MQozNzcgMzM5IDkgMjIgMjEgNDkgMjYgNjAgNSAxMSAxOSA1OCAzMSAxMDUgMjIgODQgMjIgOTUgMjUgOTM0IDMgNjg1IDEgODUxCi05IDg1OCAtNyA0IC01MiA4IC0xMDAgOCAtMTExIDAgLTExMCAxIC0xMDcgLTE3MSAxIC03MSAtMSAtMTMyIC01IC0xMzYgLTQKLTQgLTE5IDggLTMzIDI3IC05NiAxMjUgLTI1NiAyMjUgLTQyOCAyNjUgLTYyIDE1IC0yNDcgMjcgLTMwMCAxOXoiLz4KPHBhdGggZD0iTTI2MzMgMjMyNCBjLTIwIC05IC0xOCAtMTAxMyAyIC0xMTQ5IDQ2IC0zMTUgMjMyIC01MTAgNTQ0IC01NjkgMjM3Ci00NSA0NjcgOCA2MzIgMTQ2IDMzIDI3IDYzIDQ4IDY2IDQ1IDMgLTMgNiAtNDMgNyAtODkgbDEgLTgzIDIzMyAtMyAyMzIgLTIKLTIgODQ3IC0zIDg0OCAtMjQyIDMgLTI0MSAyIC01IC00ODIgYy00IC00OTkgLTYgLTUyNyAtNDggLTYxNyAtMTE1IC0yNDcKLTUyNiAtMjc5IC02NDIgLTQ5IC01MyAxMDUgLTU3IDE1NiAtNTcgNjc0IGwwIDQ3NCAtMTc0IDAgYy05NSAwIC0yMDAgMiAtMjMyCjUgLTMyIDIgLTY1IDIgLTcxIC0xeiIvPgo8cGF0aCBkPSJNMTA4NTUgMjI5MCBjLTE4MiAtMTYgLTM4NSAtOTAgLTUxMiAtMTg2IC00MSAtMzEgLTQxIC0zMCAzIC0xMDMgNTIKLTg3IDU3IC05MCAxMDcgLTU0IDE0MSAxMDIgMzA4IDE1MyA0OTcgMTUzIDIxMyAwIDM0NCAtNjEgNDE5IC0xOTQgNDggLTg1IDgwCi0zMDMgNDkgLTMzNCAtOSAtOSAtOTcgLTEyIC0zMzQgLTEyIC0zMzcgMCAtNDEwIC03IC01MzkgLTUzIC0zMDEgLTEwNyAtMzgzCi01MDcgLTE1MiAtNzM4IDIyOCAtMjI5IDc5OCAtMjAzIDk4OCA0NCAxOCAyMyAzNCA0NCAzNiA0NyAxMyAxNiAyMiAtMzcgMTkKLTExNSAtNCAtMTI0IC0zIC0xMjUgOTUgLTEyNSAxMzIgMCAxMTkgLTY0IDExOSA1NjEgMCA1MDQgLTEgNTQ4IC0yMCA2NDAgLTQ3CjIyOCAtMTYyIDM2MyAtMzcxIDQzNCAtNjIgMjEgLTI0OCA0OCAtMjk5IDQ0IC04IC0xIC01NSAtNSAtMTA1IC05eiBtNTczCi0xMDMyIGMzIC0xMjUgMiAtMTI4IC0yOSAtMTkwIC0zMyAtNjYgLTEyMSAtMTY1IC0xNzUgLTE5OSAtMTU3IC05NyAtNDA4Ci0xMTUgLTU2NSAtNDAgLTEzNCA2MyAtMTc0IDEyNCAtMTc0IDI2NSAwIDE1NSA0NyAyMTkgMTk2IDI3MCA3NCAyNiA3NCAyNgo0MDkgMjMgbDMzNSAtMiAzIC0xMjd6Ii8+CjxwYXRoIGQ9Ik04NTA3IDIyODMgYy0yNSAtNyAtMjAgLTEwNzcgNiAtMTE3OCA3OSAtMzExIDI4NiAtNDc2IDYxNyAtNDkyIDI3OQotMTQgNDcxIDY3IDYyNyAyNjIgbDMyIDQwIDAgLTEzMiBjMSAtNzIgNCAtMTM4IDcgLTE0NyA3IC0xNyAxNzYgLTI0IDIwMiAtOAoxMCA3IDEyIDE3OSAxMCA4MjggbC0zIDgxOSAtMTEyIDMgLTExMSAzIC00IC01MTggLTMgLTUxOCAtMjcgLTcyIGMtNTUgLTE1MgotMTM0IC0yNDYgLTI1OCAtMzA2IC0yNzYgLTEzMiAtNjA4IC00OCAtNzE4IDE4NCAtNTIgMTA5IC01NCAxNDEgLTU4IDcwMyAtMwo0MDYgLTYgNTIxIC0xNiA1MjggLTE0IDggLTE2MCA5IC0xOTEgMXoiLz4KPHBhdGggZD0iTTEyNjgwIDIyODMgYy0xNTkgLTI3IC0zMDkgLTExNiAtMzkxIC0yMzQgLTIzIC0zMyAtNDYgLTU2IC01MCAtNTIKLTUgNSAtMTAgNjkgLTExIDE0MyBsLTMgMTM1IC0xMDAgMCAtMTAwIDAgLTMgLTgyMiAtMiAtODIzIDIzIC02IGMxMyAtMyA2MgotNCAxMDggLTIgbDg0IDMgNiA0OTUgYzQgMjg5IDExIDUxNCAxNyA1NDAgNTkgMjU1IDIzNCA0MDMgNDkyIDQxOSBsOTUgNiAzCjEwMyAzIDEwMiAtNzMgLTEgYy00MCAtMSAtODQgLTQgLTk4IC02eiIvPjwvZz4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgwLjAwMDAwMCwzNDQuMDAwMDAwKSBzY2FsZSgwLjEwMDAwMCwtMC4xMDAwMDApIiBmaWxsPSJ1cmwoI2dnTW9sZWN1bGUpIiBzdHJva2U9Im5vbmUiPjxwYXRoIGQ9Ik02ODk0IDMzOTEgYy01NSAtOSAtMTI2IC01MyAtMTYxIC05OCAtNTAgLTY0IC02MyAtMTIxIC03OCAtMzQzIC0xMgotMTYwIC00MSAtMTgwIC0yODkgLTE5MiAtMTgzIC05IC0yMzQgLTIwIC0zMDcgLTY3IC05MSAtNTggLTEzNiAtMTI1IC0xNjQKLTI0NiAtMzcgLTE1OSA1NCAtMzMzIDIxMSAtNDA3IDU4IC0yNyA3NyAtMzEgMjEyIC0zOCAzMDIgLTE2IDMyMyAtMzggMzMzCi0zNjAgNyAtMjE2IDE0IC0yNTEgNzAgLTM2MCAyNiAtNTAgMTUyIC0xODAgMTk0IC0yMDAgMTcgLTggNDEgLTIxIDU0IC0yOSA4MQotNTEgMjc2IC02NSAzOTUgLTMwIDE5NCA1OCAzMDEgMTYzIDM4NyAzNzkgMjUgNjMgMTkgMjg0IC05IDM0NSAtNTcgMTIyIC03MQoxNDQgLTEzOSAyMTIgLTEzNCAxMzQgLTI2NSAxNzEgLTUyMyAxNTAgLTQxIC0zIC05MyAtMTEgLTExNSAtMTYgLTExMyAtMjkKLTIxNCAtNiAtMjQwIDU2IC05IDIxIC0yNCA0NyAtMzQgNTggLTI5IDMyIC00MSAxMTggLTQ0IDMwNSAtMyAyNDkgMTAgMjYzCjI0OSAyODEgMjExIDE2IDMxMyA2NyAzNzAgMTg2IDczIDE1NCAyOSAzMDYgLTExMiAzODkgLTQ0IDI2IC0xNzkgMzkgLTI2MCAyNXoiLz48L2c+Cjwvc3ZnPg==";
export function Logo({ h = 26, className = "", style = undefined }) {
  // The prototype logo is an inline SVG data URL, so Next Image optimization does
  // not provide a network or sizing benefit here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={GG_LOGO} alt="Gutguard" className={className} style={{ height: h, width: "auto", display: "block", ...(style || {}) }} />;
}
const DISEASE_FACTORY_URL = "/science#mechanism";

/* protocol ladder — per-cap follows TikTok. CONFIRM caps for Start & Grow (scaled from Peak: 400 caps / 90 days). */
const GROW = TIERS.find((tier) => tier.id === "grow");
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

/* signature illustration — the SynBIOTIC+ capsule: inflammation (heat) → recovery (blue), bridged by the biotic molecule */
function IllustCapsule({ className, style }) {
  return (
    <Image
      className={className}
      style={style}
      src="/synbiotic-capsule.png"
      alt=""
      width={772}
      height={646}
      aria-hidden="true"
    />
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
/* per-page section jump-nav — shown persistently under the nav */
const SECTIONS = {
  "/": [["Overview", "top"], ["Why Now", "why-now"], ["Cost", "cost"], ["Protocol", "protocol"], ["Evidence", "evidence"]],
  "/science": [["Overview", "top"], ["Mechanism", "mechanism"], ["Triggers", "triggers"], ["Measure", "measure"], ["Standard", "standard"]],
  "/system": [["Overview", "top"], ["The Stack", "stack"], ["Proof", "proof"], ["Two Reads", "readings"]],
};

const FOOTER_GROUPS = [
  ["Shop", [["SynBIOTIC+", "/shop"], ["Compare plans", "/shop#flagship"]]],
  ["Learn", [["Why GutGuard", "/#why-now"], ["How It Works", "/system"], ["Science", "/science"], ["Evidence", "/#evidence"]]],
  ["Support", [["Order help", "/shop"]]],
  ["Professionals", [["For Physicians", "/physicians"], ["Become a physician partner", "/physicians/register"], ["Partner dashboard", "/partner"], ["BioScan Login", APP_URL]]],
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
  const here = route === "/" ? "Home" : (NAV.find(([, r]) => r === route) || [])[0];
  return (
    <>
      <nav className={"nav" + (scrolled ? " scrolled" : "")} aria-label="Primary">
        <div className="nav-inner">
          <div className="nav-lead">
            <Link className="brand" href="/" aria-label="Gutguard home"><Logo h={29} /></Link>
            {here && <span className="nav-here" aria-hidden="true">{here}</span>}
          </div>
          <div className="nav-links">
            {NAV.map(([l, r]) => (
              <a key={r} href={r} aria-current={(route === r || (route === "/" && r.startsWith("/#"))) ? "page" : undefined}>{l}</a>
            ))}
          </div>
          <div className="nav-actions">
            <a className="nav-login" href="/partner" aria-label="Open the partner login page">Log in</a>
            <a className="nav-cta" href="/shop">Choose Your Protocol <ArrowRight size={14} /></a>
          </div>
          <a className="nav-shop-mobile" href="/shop">Shop</a>
          <button ref={burgerRef} className="burger" aria-label="Open menu" aria-haspopup="dialog" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
        </div>
      </nav>
      <div id="mobile-menu" ref={sheetRef} className={"sheet" + (open ? " open" : "")} role="dialog" aria-modal="true" aria-label="Site menu">
        <button className="burger sheet-close" aria-label="Close menu" onClick={() => setOpen(false)}><X size={20} /></button>
        {NAV.map(([l, r], i) => (
          <a key={r} href={r} aria-current={(route === r || (route === "/" && r.startsWith("/#"))) ? "page" : undefined} onClick={() => setOpen(false)}>
            <em>{String(i + 1).padStart(2, "0")}</em>{l}
          </a>
        ))}
        <a className="nav-cta" href="/shop" onClick={() => setOpen(false)}>Choose Your Protocol <ArrowRight size={16} /></a>
        <a className="sheet-login" href="/partner">Already a partner? Log in →</a>
      </div>
    </>
  );
}

function Footer() {
  const currentYear = new Date().getFullYear();
  const [isCompact, setIsCompact] = useState(false);
  const [openGroups, setOpenGroups] = useState(() =>
    Object.fromEntries(FOOTER_GROUPS.map(([label]) => [label, false]))
  );

  useEffect(() => {
    const query = window.matchMedia("(max-width: 860px)");
    const update = () => {
      setIsCompact(query.matches);
      if (query.matches) {
        setOpenGroups(Object.fromEntries(FOOTER_GROUPS.map(([label]) => [label, false])));
      }
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const toggleGroup = (label) => {
    if (!isCompact) return;
    setOpenGroups((current) => ({ ...current, [label]: !current[label] }));
  };

  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-main">
          <div className="footer-brand">
            <Logo h={34} />
            <p>Science-backed support for gut and cellular recovery.</p>
          </div>
          <nav className="footer-groups" aria-label="Footer">
            {FOOTER_GROUPS.map(([label, links]) => {
              const panelId = "footer-" + label.toLowerCase().replace(/\s+/g, "-");
              const expanded = isCompact ? openGroups[label] : true;
              return (
                <section className={"footer-group footer-group--" + label.toLowerCase() + (expanded ? " open" : "")} key={label}>
                  <button
                    type="button"
                    className="footer-group-toggle"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => toggleGroup(label)}
                  >
                    {label}<span aria-hidden="true">+</span>
                  </button>
                  <ul id={panelId}>
                    {links.map(([text, href]) => (
                      <li key={text}><a href={href}>{text}</a></li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </nav>
        </div>
        <div className="footer-legal">
          <span>IG INTERNATIONAL CORP. · FDA CPR No. FR-40000015571456 · LTO-30000007262499</span>
          <span>Davao City, Philippines · © {currentYear} GutGuard</span>
        </div>
      </div>
    </footer>
  );
}
function TrustStrip() {
  const items = [["FDA", "Registered · CPR FR-400…456"], ["USAID", "Funded research"], ["MSU-IIT", "Co-developed R&D"], ["19", "Branches nationwide"], ["80B", "CFU · 17 strains"]];
  return (
    <section className="trust" aria-labelledby="trust-heading"><div className="wrap">
      <div className="trust-label reveal" id="trust-heading">Research and registration</div>
      <div className="trust-grid reveal">
        {items.map(([n, l]) => <div className="trust-item" key={l}><div className="n">{n}</div><div className="l">{l}</div></div>)}
      </div>
    </div></section>
  );
}

function Compliance() {
  return (
    <section className="compliance-strip"><div className="wrap">
      <div className="compliance reveal">
        <div className="comp-seal"><IconGuard size={26} /></div>
        <div className="comp-txt">
          <h3>Honest by design.</h3>
          <div className="b">We describe support for inflammation and recovery without presenting SynBIOTIC+ as a treatment or cure. Consult a licensed physician for personal health decisions.</div>
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
          <div className="sec-label" id="your-number"><span className="num">03</span> Your number <BetaFlag variant="sec" /></div>
          <h2 className="sec">One number you’ll remember: <em>your MiAge.</em> <span className="sec-h-beta">Beta</span></h2>
          <p className="sec-sub"><strong>Your BioScan is included with every protocol</strong> — a baseline, then re-tests at Day 30, 60 and 90. From the lab tests you already have, we read two things. Your Lifestyle Inflammation Score (GLIS) measures low-grade chronic systemic inflammation — what doctors track with markers like hs-CRP, and what science calls inflammaging as it builds with age.<sup><a href="#ref2">2</a></sup> It reads as a cardiometabolic composite: not just inflammatory markers, but the metabolic sources that fuel them, like visceral fat and insulin resistance. Your MiAge then translates that into a biological age in years, set against your real age.</p>
        </div>
      )}
      <div className="miage-block reveal">
        <div className="miage-hero">
          <span className="mh-label">MiAge · Mitochondrial Age <span className="mh-beta">Beta</span></span>
          <div className="mh-pair">
            <div className="mh-real">41</div>
            <div className="mh-arrow" aria-hidden="true">&rarr;</div>
            <div className="mh-num"><CountUp to={48} /><span>yrs</span></div>
          </div>
          <div className="mh-legend"><span>Calendar age</span><span aria-hidden="true">&nbsp;</span><b>MiAge</b></div>
          <p className="mh-say">&ldquo;I&rsquo;m 41. My MiAge is 48.&rdquo;</p>
          <div className="mh-eg">Illustrative example</div>
          <p className="mh-desc">Mitochondria are your cells’ engine and repair system. Chronic inflammation wears them down, and worn mitochondria fuel more inflammation — a loop aging science treats as a core driver of how fast we age.<sup><a href="#ref9">9</a></sup> Because mitochondrial decline is a hallmark of that aging,<sup><a href="#ref11">11</a></sup> we name your biological age after it. Calendar age 41, MiAge 48 means your body may be running about seven years ahead — a gap to close, not a diagnosis.</p>
          <LaunchCountdown />
          <div className="mh-betaline"><b>MiAge is in Beta</b>It runs on our v1 formulary while an independent clinical study is ongoing. A wellness indicator, not a diagnostic.</div>
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
        <span className="mm-label">How MiAge is derived <BetaFlag /></span>
        <p>MiAge is a validated-method biological age from a routine, affordable blood test — no expensive DNA lab. Where your panel is complete, it’s anchored on the PhenoAge algorithm<sup><a href="#ref10">10</a>,<a href="#ref14">14</a></sup> and extended with cardiometabolic markers standard clocks leave out — insulin resistance, uric acid, adiposity.<sup><a href="#ref12">12</a>,<a href="#ref13">13</a></sup> Confidence rises with how complete your panel is.</p>
      </div>
      <a className="measure-link reveal" href={DISEASE_FACTORY_URL}>See the mechanism behind MiAge: how gut leakage drives inflammation and mitochondrial aging <ArrowRight size={15} /></a>
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
        <BetaFlag block />
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
            <p className="hero-lede">Chronic inflammation can build silently for years before symptoms. <strong>The 90-day protocol is designed to support gut and inflammatory balance.</strong> Routine blood markers at Day 30, 60 and 90 can show how your trajectory changes. <strong>Progress you can follow.</strong></p>
            <div className="hero-actions">
              <a className="btn-primary" href="/shop" data-buyanchor>Start the 90-Day Protocol <Arrow /></a>
              <a className="btn-ghost" href="/system"><span className="ring"><ArrowRight size={13} /></span>See how the scan works</a>
            </div>
            <ul className="hero-proof reveal" aria-label="Why this is credible">
              <li>FDA-registered formula</li>
              <li>Research with MSU-IIT</li>
              <li>Physician-led clinical program</li>
              <li>19 branches nationwide</li>
            </ul>
          </div>
          <div className="hero-visual reveal">
            <div className="portrait" role="img" aria-label="GutGuard gut-mitochondrial protocol visualization">
              <div className="grade" aria-hidden="true" /><div className="grain" aria-hidden="true" /><div className="vig" aria-hidden="true" />
              <span className="ph" aria-hidden="true">The Gut-Mitochondrial Axis</span>
            </div>
            <div className="bioscan reveal" aria-label="Demonstration Blood Scan readout — Beta">
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
              <div className="bs-foot">
                <span className="bs-lc"><LaunchNote /></span>
                <span className="bs-sample">Demonstration readout · Beta</span>
              </div>
            </div>
          </div>
        </div></div>
      </header>

      <hr className="seam" />

      <section className="section younger"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="why-now"><span className="num">01</span> Why now</div>
          <h2 className="sec">The body can age faster than the calendar — and it’s <em>starting younger.</em></h2>
          <p className="sec-sub">Ultra-processed food, chronic stress, and too little sleep drive chronic low-grade inflammation.<sup><a href="#ref1">1</a></sup> Once tied to later life, it now shows up in the 20s and 30s.</p>
        </div>
        <p className="sec-body reveal" style={{ marginTop: 28 }}>You can’t feel low-grade inflammation. You can measure it — and the earlier you do, the more time you have to act.</p>
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
      <section className="section"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="protocol"><span className="num">04</span> The protocol</div>
          <h2 className="sec">Three steps. Ninety days. <em>One</em> flagship.</h2>
          <p className="sec-sub">SynBIOTIC+ — the Gut-Mitochondrial Axis, powered.</p>
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

      <TrustStrip />

      <section className="section"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="doors"><span className="num">05</span> Other doors</div>
          <h2 className="sec">Here for a different reason? <em>Choose your path.</em></h2>
        </div>
        <div className="doors reveal">
          <article className="door">
            <span className="ic"><IconClinical size={22} /></span>
            <h3>Physicians</h3>
            <p>Explore the measured protocol and the Lead Clinical Adopter program.</p>
            <a className="lnk" href="/physicians">Explore the physician program <ArrowRight size={15} /></a>
          </article>
          <article className="door">
            <span className="ic"><IconPeople size={22} /></span>
            <h3>Registered partners</h3>
            <p>Sign in securely to view your tracked links, clicks, and attributed orders.</p>
            <a className="lnk" href="/partner">Open partner dashboard <ArrowRight size={15} /></a>
          </article>
          <article className="door">
            <span className="ic"><IconNetwork size={22} /></span>
            <h3>Start the protocol</h3>
            <p>Choose the protocol length or begin with one of the trial formats.</p>
            <a className="lnk" href="/shop">Visit the GutGuard shop <ArrowRight size={15} /></a>
          </article>
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
            <p>A joint research study and partnership with Beehive Brain Developmental Center, in collaboration with MSU-IIT as the research institution — a 12-week protocol evaluating change in inflammatory and gut-axis markers. Results will be published when the study is complete and cleared for public release.</p>
          </li>
          <li>
            <span className="ev-status">Pilot underway</span>
            <h4>Lead Clinical Adopter outcomes</h4>
            <p>Before-and-after inflammation readings from patients on the protocol under physician supervision. Aggregate outcomes will be published after collection and review.</p>
          </li>
        </ul>
        <p className="ref-note reveal">Entries above describe evidence GutGuard is generating. No study outcome is claimed before reviewed results are available, and nothing here is a therapeutic claim.</p>
      </div></section>

      <FinalCTA />
      <Compliance />
    </>
  );
}

function Science() {
  return (
    <>
      <header className="hero" id="top">
        <div className="wrap"><div className="narrow reveal" style={{ maxWidth: 760 }}>
          <span className="eyebrow">The Science</span>
          <h1>The science, <em>in plain sight.</em></h1>
          <p className="hero-lede">No black box. Here is exactly how inflammation compounds into the way you feel — and how the right repair runs it in reverse.</p>
          <div className="hero-actions"><a className="btn-primary" href="/shop">Start the 90-Day Protocol <Arrow /></a></div>
        </div></div>
      </header>

      <hr className="seam" />

      <section className="section"><div className="wrap">
        <div className="reveal" style={{ marginBottom: 8 }}>
          <div className="sec-label" id="mechanism"><span className="num">01</span> The mechanism</div>
          <h2 className="sec">How a leaky gut quietly becomes a <em>tired body.</em></h2>
          <p className="sec-body" style={{ marginTop: 14 }}>When the gut barrier weakens, bacterial fragments can enter the bloodstream. The immune system reacts, inflammation spreads body-wide, and it wears down the mitochondria that power your cells — which can fuel still more inflammation.<sup><a href="#mref1">1</a>,<a href="#mref2">2</a>,<a href="#mref3">3</a></sup> This is the biological pathway the measurement system is designed to track.</p>
        </div>
        <div className="teaser reveal">
          <div className="teaser-art" role="img" aria-label="Gut, inflammation, and mitochondrial aging pathway"><span className="teaser-play" aria-hidden="true"><IconNetwork size={30} /></span></div>
          <div className="teaser-body">
            <h3>The gut–inflammation pathway</h3>
            <p>See how gut-barrier disruption, inflammatory signalling, and mitochondrial stress connect—and how the BioScan, GLIS, and MiAge layers are intended to describe that trajectory.</p>
            <a className="btn-ghost" href="/system"><span className="ring"><ArrowRight size={13} /></span>Explore the measurement system</a>
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
            <a className="btn-primary" href="/system">See the measurement system <Arrow /></a>
          </div>
        </div>
      </div></section>

      <section className="section science-standard"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="standard"><span className="num">04</span> The standard we hold</div>
          <h2 className="sec">Science built to <em>global standards.</em></h2>
          <p className="sec-body">Developed with research partners, registered with the FDA, and supported by USAID-funded work, our measurement approach uses accessible laboratory markers to keep the science grounded and repeatable.</p>
        </div>
      </div></section>

      <TrustStrip />
      <Compliance />
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
          <div className="hero-actions"><a className="btn-primary" href="/physicians/register">Request the program brief <Arrow /></a></div>
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

      <section className="section rationale" style={{ background: "var(--slate)", position: "relative", overflow: "hidden" }}><Constellation /><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="rationale" style={{ color: "var(--slate-mut)" }}><span className="num">02</span> The recovery rationale</div>
          <h2 className="sec" style={{ color: "#F4F1EA" }}>A layered <em>recovery</em> system — not just a probiotic.</h2>
          <p className="sec-body" style={{ color: "#B8C6D6" }}>SynBIOTIC+ pairs a spore-forming probiotic with prebiotic, postbiotic and antioxidant layers — a layered design, uncommon among probiotics, positioned as post-antibiotic gut and cellular recovery. Described as support, not the treatment or prevention of any disease.</p>
        </div>
        <div className="layers reveal">
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

      <FinalCTA label="The founding 100" title={<>Read the inflammation. <em>Practise the upstream.</em></>} body="Request the LCA program brief and clinical dosing guidance for licensed Filipino physicians." cta="Request the program brief" href="/physicians/register" />
      <Compliance />
    </>
  );
}

function FinalCTA({ label = "Measured, not guessed.", title = <>The 90 days come first. <em>Then the number.</em></>, body = "Start the protocol today. At Day 30, 60 and 90 your BioScan shows you what changed — and your MiAge tells you in years. We’ll be with you at every re-test.", cta = "Start the 90-Day Protocol", href = "/shop" }) {
  return (
    <section className="final"><div className="wrap final-in reveal">
      <div className="lab">{label}</div>
      <h2>{title}</h2>
      <p>{body}</p>
      <a className="btn-bone" href={href}>{cta} <span className="arr"><ArrowRight size={14} /></span></a>
    </div></section>
  );
}

function System() {
  const layers = [
    ["01", "BioScan", "Sample", "You provide your own blood test results — upload the file or photograph it. The system scans a defined set of biomarkers from any standard lab test, then rates data confidence.", "who", "Input"],
    ["02", "GLIS", "Score", "Gutguard Lifestyle Inflammation Score — a 0–100 reading of low-grade chronic systemic inflammation (inflammaging) across inflammatory, metabolic, adiposity and organ-function markers, with a data-confidence rating. Scattered markers become one signal.", "who md", "Physician-facing"],
    ["03", "MiAge", "Translate", "Beta · in validation. MiAge is designed to translate the measurement into years and show direction across repeat scans, not just a single snapshot.", "who pt", "Patient-facing"],
  ];
  return (
    <>
      <header className="hero" id="top">
        <div className="wrap"><div className="narrow reveal" style={{ maxWidth: 760 }}>
          <span className="eyebrow">The System</span>
          <h1>Three layers between a <em>sample</em> and an answer.</h1>
          <p className="hero-lede">No single number tells the whole story. Gutguard reads inflammation through a measured stack — a sample, a composite score, and a translation you can actually feel.</p>
          <div className="hero-actions">
            <a className="btn-primary" href="/shop">Start the 90-Day Protocol <Arrow /></a>
            <a className="btn-ghost" href="/physicians"><span className="ring"><ArrowRight size={13} /></span>For physicians</a>
          </div>
        </div></div>
      </header>

      <hr className="seam" />

      <section className="section"><div className="wrap">
        <div className="reveal">
          <div className="sec-label" id="stack"><span className="num">01</span> The stack <BetaFlag variant="sec" lt /></div>
          <h2 className="sec">From your lab results to <em>meaning.</em> <span className="sec-h-beta lt">Beta</span></h2>
          <p className="sec-sub">Built on routine, accessible lab markers — repeatable anywhere. <strong>The scan layer is in Beta:</strong> BioScan and MiAge remain in validation and are not presented as diagnostic tools.</p>
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
        <p className="tier-note">Confidence is shown with every result — never more than your data earns. MiAge remains in validation and is intended for tracking progress over time, not as a medical diagnosis.</p>
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
          <div className="col pt"><div className="tag">What you see</div><h3>MiAge <BetaFlag lt /></h3><div className="full">Mitochondrial Age</div><div className="big">53<span style={{ fontSize: 22 }}>y</span></div><p>Your biological age from the same labs — anchored on the validated PhenoAge algorithm and extended with your cardiometabolic markers. Named for the mitochondrial aging that inflammaging drives. Yours to track at every re-test.</p><BetaFlag lt block /></div>
          <div className="col md"><div className="tag">What your doctor sees</div><h3>GLIS</h3><div className="full">Gutguard Lifestyle Inflammation Score</div><div className="big">62</div><p>The 0–100 measure of low-grade chronic systemic inflammation — inflammaging — across inflammatory, metabolic, adiposity and organ-function markers, with a data-confidence rating. The measured foundation of your MiAge.</p></div>
        </div>
        <div className="vault reveal"><Lock size={20} /><span>Some upstream methodology is held as protected intellectual property and isn’t shown publicly — what you see here are the disclosable layers of the system.</span></div>
      </div></section>

      <TrustStrip />
      <Compliance />
    </>
  );
}

// Commerce is intentionally not part of this client-side marketing router. Both
// /shop and /checkout are owned by the production Supabase + Maya shop.
const ROUTES = { "/": Home, "/science": Science, "/system": System, "/physicians": Physicians };

function SectionTabs({ items }) {
  const [active, setActive] = useState(items[0][1]);
  const [top, setTop] = useState(60);
  const [shown, setShown] = useState(false);
  const innerRef = useRef(null);
  const vis = useRef(new Set());

  /* sit flush under the nav, whatever its measured height */
  useEffect(() => {
    const measure = () => { const n = document.querySelector(".nav"); if (n) setTop(n.offsetHeight); };
    const nav = document.querySelector(".nav");
    const observer = nav && "ResizeObserver" in window ? new ResizeObserver(measure) : null;
    measure();
    if (nav && observer) observer.observe(nav);
    window.addEventListener("resize", measure);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  /* Keep page entry focused on the hero. Reveal contextual navigation once the
     hero has moved beneath the primary header. */
  useEffect(() => {
    const update = () => {
      const hero = document.querySelector("main > header");
      const nav = document.querySelector(".nav");
      if (!hero) return setShown(window.scrollY > 160);
      setShown(hero.getBoundingClientRect().bottom <= (nav ? nav.offsetHeight : 64));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  /* scrollspy */
  useEffect(() => {
    const ids = items.map((i) => i[1]);
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) vis.current.add(e.target.id);
          else vis.current.delete(e.target.id);
        });
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
    <nav className={"sectabs" + (shown ? " show" : "")} style={{ top }} aria-label="On this page" aria-hidden={!shown}>
      <div className="sectabs-inner" ref={innerRef}>
        {items.map(([label, id]) => (
          <button key={id} tabIndex={shown ? 0 : -1} className={"sectab" + (active === id ? " on" : "")} aria-current={active === id ? "true" : undefined} onClick={() => go(id)}>{label}</button>
        ))}
      </div>
    </nav>
  );
}

function BuyBar({ route }) {
  const [shown, setShown] = useState(false);
  const enabled = route === "/" || route === "/shop";
  useEffect(() => {
    if (!enabled) { setShown(false); return; }
    let anchorPassed = false;
    const ends = new Set();
    const update = () => setShown(anchorPassed && ends.size === 0);
    /* show once the on-page product CTA has scrolled above the viewport */
    const anchor = document.querySelector("[data-buyanchor]");
    let aObs, onScroll;
    if (anchor) {
      aObs = new IntersectionObserver(
        ([e]) => { anchorPassed = !e.isIntersecting && e.boundingClientRect.top < 0; update(); },
        { threshold: 0 }
      );
      aObs.observe(anchor);
    } else {
      onScroll = () => { anchorPassed = window.scrollY > Math.min(560, window.innerHeight * 0.6); update(); };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    /* yield near the footer / final CTA so two CTAs never stack */
    const eObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) ends.add(e.target);
          else ends.delete(e.target);
        });
        update();
      },
      { threshold: 0 }
    );
    document.querySelectorAll("footer, .final").forEach((el) => eObs.observe(el));
    return () => { if (aObs) aObs.disconnect(); if (onScroll) window.removeEventListener("scroll", onScroll); eObs.disconnect(); };
  }, [route, enabled]);

  if (!enabled) return null;
  return (
    <nav className={"buybar" + (shown ? " show" : "")} aria-label="Purchase SynBIOTIC+">
      <div className="buybar-inner">
        <div className="bb-thumb" aria-hidden="true">
          <Image src="/shop/bottle.png" alt="" width={44} height={58} />
        </div>
        <div className="bb-info">
          <span className="bb-name">SynBIOTIC+ {GROW.name}</span>
          <span className="bb-meta">{GROW.phase} protocol <span className="bb-tag">Most popular</span></span>
        </div>
        <div className="bb-price">
          <span className="bb-amt">₱{GROW.perCap} / capsule</span>
          <span className="bb-sub">{GROW.phase} protocol · ₱{GROW.price.toLocaleString("en-PH")} total</span>
        </div>
        <a className="btn-primary bb-cta" tabIndex={shown ? 0 : -1} href="/shop#flagship">Compare Protocols <Arrow /></a>
      </div>
    </nav>
  );
}

export default function GutguardSite({ initialRoute = "/" }) {
  const [route, setRoute] = useState(initialRoute);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const mainRef = useRef(null);
  const sheetRef = useRef(null);
  const burgerRef = useRef(null);
  const pendingScrollRef = useRef(null);

  /* hash routing */
  useEffect(() => {
    const onHash = () => {
      const hashRoute = window.location.hash.replace(/^#/, "");
      setRoute(hashRoute.startsWith("/") ? hashRoute : initialRoute);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [initialRoute]);

  // The prototype's Shop and Checkout are visual mocks. Production purchases must
  // always enter the existing Supabase + Maya flow, whose server validates prices.
  useEffect(() => {
    if (route === "/shop" || route === "/checkout") {
      window.location.replace("/shop");
    }
  }, [route]);

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
    setRoute(to);
    try { window.history.replaceState(null, "", "#" + to); } catch {}
  };

  const Page = ROUTES[route] || Home;

  /* jump to a section — scroll if already on the page, else navigate then scroll */
  return (
    <div className="gg" onClick={handleNavClick}>
      <style>{CSS}</style>
      <a className="skip" href="#main">Skip to content</a>
      <Nav route={route} scrolled={scrolled} open={open} setOpen={setOpen} sheetRef={sheetRef} burgerRef={burgerRef} />
      {SECTIONS[route] && <SectionTabs key={route} items={SECTIONS[route]} />}
      <main id="main" ref={mainRef} tabIndex={-1}>
        <Page />
      </main>
      <Footer />
      <BuyBar route={route} />
    </div>
  );
}
