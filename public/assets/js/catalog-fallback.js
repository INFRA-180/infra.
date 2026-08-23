(function () {
  "use strict";

  const fallbackCatalog = {
  "apps": [
    {
      "id": "vizu",
      "title": "VIZU",
      "editKey": "app_vizu",
      "page": "apps/vizu.html",
      "thumb": "assets/apps/vizu-icon-balanced-detoure-500.png",
      "thumbAlt": "Icone VIZU",
      "width": 500,
      "height": 500,
      "download": {
        "type": "app_download",
        "label": "Download VIZU",
        "appName": "VIZU",
        "url": "https://drive.google.com/uc?export=download&id=16ZsO2eOD498AgWNoeejQFW4ztNwTTDwI"
      }
    },
    {
      "id": "reverb",
      "title": "REVERB TIME CALCULATOR",
      "editKey": "app_reverb",
      "page": "apps/reverb-time-calculator.html",
      "thumb": "assets/apps/reverb-icon.png?v=20260213b",
      "thumbAlt": "Icone REVERB TIME CALCULATOR",
      "width": 500,
      "height": 500,
      "download": {
        "type": "app_download",
        "label": "Download REVERB TIME CALCULATOR",
        "appName": "REVERB TIME CALCULATOR",
        "url": "https://drive.google.com/uc?export=download&id=18EGtIO_-bwDri6yX_VKl_XFBbYC8Qm2I"
      }
    },
    {
      "id": "infra-extract",
      "title": "INFRA_EXTRACT",
      "editKey": "app_extract",
      "page": "apps/infra-extract.html",
      "thumb": "assets/apps/infra-extract-icon.png?v=20260213",
      "thumbAlt": "Icone INFRA_EXTRACT",
      "width": 500,
      "height": 500,
      "download": {
        "type": "app_download",
        "label": "Download INFRA_EXTRACT",
        "appName": "INFRA_EXTRACT",
        "url": "https://drive.google.com/uc?export=download&id=1qm_BELRHQeovtx9ad0cqJul_BbuCFeoD"
      }
    }
  ],
  "albums": [
    {
      "id": "d-2-0141",
      "title": "D 2.0141",
      "editKey": "album_d_2_0141",
      "page": "music/d-2-0141-infra.html",
      "thumb": "assets/music/responsive/d-2-0141-2dfeb783-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - D 2.0141",
      "width": 800,
      "height": 800
    },
    {
      "id": "v-23pi56",
      "title": "V-23π56",
      "editKey": "album_v_23pi56",
      "page": "music/v-23pi56-infra.html",
      "thumb": "assets/music/responsive/v-23pi56-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - V-23π56",
      "width": 800,
      "height": 800
    },
    {
      "id": "he-4-0026",
      "title": "He 4.0026",
      "editKey": "album_he_4_0026",
      "page": "music/he-4-0026-infra.html",
      "thumb": "assets/music/responsive/he-4-0026-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - He 4.0026",
      "width": 800,
      "height": 800
    },
    {
      "id": "h-1-008",
      "title": "H 1.008",
      "editKey": "album_h_1_008",
      "page": "music/h-1-008-infra.html",
      "thumb": "assets/music/responsive/h-1-008-cover-1200.webp",
      "thumbAlt": "Cover H 1.008 - INFRA.",
      "width": 800,
      "height": 800,
      "download": {
        "type": "download",
        "label": "Download H 1.008",
        "url": "https://drive.google.com/uc?export=download&id=1tf1FBj3LsaNtq-dgftM-PjXdbon4y-V7"
      }
    },
    {
      "id": "kali",
      "title": "KALI",
      "editKey": "album_kali",
      "page": "music/kali-infra.html",
      "thumb": "assets/music/responsive/kali-cover-1200.webp",
      "thumbAlt": "Cover KALI - INFRA.",
      "width": 800,
      "height": 800,
      "download": {
        "type": "download",
        "label": "Download KALI",
        "url": "https://drive.google.com/uc?export=download&id=1q9WXnRi1Inp0AeU7a6FMW4Dxj4tAKwZa"
      }
    },
    {
      "id": "asase-yaa",
      "title": "ASASE YAA",
      "editKey": "album_asase_yaa",
      "page": "music/asase-yaa-infra.html",
      "thumb": "assets/music/responsive/asase-yaa-cover-1200.webp",
      "thumbAlt": "Cover ASASE YAA - INFRA.",
      "width": 800,
      "height": 800,
      "download": {
        "type": "download",
        "label": "Download ASASE YAA",
        "url": "https://drive.google.com/uc?export=download&id=124ttLRZkovE9l5roAps7WGU678BLIgmR"
      }
    },
    {
      "id": "anunnaki",
      "title": "𒀭𒉣𒆠",
      "editKey": "album_anunnaki",
      "page": "music/anunnaki-infra.html",
      "thumb": "assets/music/responsive/anunnaki-cover-1200.webp",
      "thumbAlt": "Cover 𒀭𒉣𒆠 - INFRA.",
      "width": 800,
      "height": 800,
      "download": {
        "type": "download",
        "label": "Download 𒀭𒉣𒆠",
        "url": "https://drive.google.com/uc?export=download&id=165BIWQnMCEJA7nP8W_mtbYYRyhKgHUai"
      }
    },
    {
      "id": "anunnaki-instru",
      "title": "𒁀𒆷𒂵 𒈜",
      "editKey": "album_anunnaki_instru",
      "page": "music/anunnaki-instru-infra.html",
      "thumb": "assets/music/responsive/anunnaki-instru-6a799ef0-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - 𒁀𒆷𒂵 𒈜",
      "width": 800,
      "height": 800
    },
    {
      "id": "impression",
      "title": "IMPRESSION",
      "editKey": "album_impression",
      "page": "music/impression-infra.html",
      "thumb": "assets/music/responsive/impression-cover-1200.webp",
      "thumbAlt": "Cover IMPRESSION - INFRA.",
      "width": 800,
      "height": 800,
      "download": {
        "type": "download",
        "label": "Download Impression",
        "url": "https://drive.google.com/uc?export=download&id=1QHQz22R0d8e3WoR3MlEFA9_-R_7T16_w"
      }
    },
    {
      "id": "nahda",
      "title": "نهضة",
      "editKey": "album_nahda",
      "page": "music/nahda-infra.html",
      "thumb": "assets/music/responsive/nahda-cover-1200.webp",
      "thumbAlt": "Cover نهضة - INFRA.",
      "width": 800,
      "height": 800,
      "download": {
        "type": "download",
        "label": "Download نهضة",
        "url": "https://drive.google.com/uc?export=download&id=14TL52jrxRAH3OCQsJs8eyld8-cWUkBAv"
      }
    },
    {
      "id": "etoiles",
      "title": "ETOILES",
      "editKey": "album_etoiles",
      "page": "music/etoiles-infra.html",
      "thumb": "assets/music/responsive/etoiles-cover-1200.webp",
      "thumbAlt": "Cover ETOILES - INFRA.",
      "width": 800,
      "height": 800,
      "download": {
        "type": "download",
        "label": "Download ETOILES",
        "url": "https://drive.google.com/uc?export=download&id=1YQw0zOsOMEYw6pszJc6BuBDsxPNFYeVK"
      }
    },
    {
      "id": "salam",
      "title": "سَلام",
      "editKey": "album_salam",
      "page": "music/salam-infra.html",
      "thumb": "assets/music/responsive/salam-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - سَلام",
      "width": 800,
      "height": 800,
      "download": {
        "type": "download",
        "label": "Download سَلام",
        "url": "https://drive.google.com/uc?export=download&id=1NjMyfAx6jKInnLJN4bnGIGyS4BRXQG3H"
      }
    },
    {
      "id": "fond-diffus",
      "title": "FOND DIFFUS",
      "editKey": "album_fond_diffus",
      "page": "music/fond-diffus-infra.html",
      "thumb": "assets/music/responsive/fond-diffus-e28f5aa2-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - FOND DIFFUS",
      "width": 800,
      "height": 800,
      "download": {
        "type": "download",
        "label": "Download Fond Diffus",
        "url": "https://drive.google.com/uc?export=download&id=16b9lJD5gCC-M49FxEM56sbEO2DGKEinV"
      }
    },
    {
      "id": "ballades",
      "title": "BALLADES",
      "editKey": "album_ballades",
      "page": "music/ballades-infra.html",
      "thumb": "assets/music/responsive/ballades-cover-1200.webp",
      "thumbAlt": "Cover BALLADES - INFRA.",
      "width": 800,
      "height": 800,
      "download": {
        "type": "download",
        "label": "Download Ballades",
        "url": "https://drive.google.com/uc?export=download&id=1eXlFHETITEWvj6artl-JJUxELwuZ8Egu"
      }
    },
    {
      "id": "trou-noir",
      "title": "TROU NOIR",
      "editKey": "album_trou_noir",
      "page": "music/trou-noir-infra.html",
      "thumb": "assets/music/responsive/trou-noir-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - TROU NOIR",
      "width": 800,
      "height": 800,
      "download": {
        "type": "download",
        "label": "Download Trou Noir",
        "url": "https://drive.google.com/uc?export=download&id=1agshYrhNFZaj00fw-fDaxtvGLUjdjhmO"
      }
    },
    {
      "id": "voyager",
      "title": "VOYAGER",
      "editKey": "album_voyager",
      "page": "music/voyager-infra.html",
      "thumb": "assets/music/responsive/voyager-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - VOYAGER",
      "width": 800,
      "height": 800,
      "download": {
        "type": "download",
        "label": "Download Voyager",
        "url": "https://drive.google.com/uc?export=download&id=1X69enZ8oS-cvicQsZw309jEESUfSvk4T"
      }
    },
    {
      "id": "sanguin",
      "title": "SANGUIN",
      "editKey": "album_sanguin",
      "page": "music/sanguin-infra.html",
      "thumb": "assets/music/responsive/sanguin-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - SANGUIN",
      "width": 800,
      "height": 800
    },
    {
      "id": "naviguer",
      "title": "NAVIGUER",
      "editKey": "album_naviguer",
      "page": "music/naviguer-infra.html",
      "thumb": "assets/music/responsive/naviguer-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - NAVIGUER",
      "width": 800,
      "height": 800,
      "download": {
        "type": "download",
        "label": "Download Naviguer",
        "url": "https://drive.google.com/uc?export=download&id=1FlxhF_vEDBJpwRnA2LvPYIGKxVup53dS"
      }
    },
    {
      "id": "pbb",
      "title": "PBB",
      "editKey": "album_pbb",
      "page": "music/pbb-infra.html",
      "thumb": "assets/music/responsive/pbb-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - PBB",
      "width": 800,
      "height": 800
    },
    {
      "id": "rue-de-paris",
      "title": "RUE DE PARIS",
      "editKey": "album_rue_de_paris",
      "page": "music/rue-de-paris-infra.html",
      "thumb": "assets/music/responsive/rue-de-paris-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - RUE DE PARIS",
      "width": 800,
      "height": 800
    },
    {
      "id": "black-stallion",
      "title": "BLACK STALLION",
      "editKey": "album_black_stallion",
      "page": "music/black-stallion-infra.html",
      "thumb": "assets/music/responsive/black-stallion-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - BLACK STALLION",
      "width": 800,
      "height": 800
    },
    {
      "id": "osiris",
      "title": "OSIRIS",
      "editKey": "album_osiris",
      "page": "music/osiris-infra.html",
      "thumb": "assets/music/responsive/osiris-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - OSIRIS",
      "width": 800,
      "height": 800
    },
    {
      "id": "cyberpunk",
      "title": "CYBERPUNK",
      "editKey": "album_cyberpunk",
      "page": "music/cyberpunk-infra.html",
      "thumb": "assets/music/responsive/cyberpunk-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - CYBERPUNK",
      "width": 800,
      "height": 800
    },
    {
      "id": "aspasie",
      "title": "ASPASIE",
      "editKey": "album_aspasie",
      "page": "music/aspasie-infra.html",
      "thumb": "assets/music/responsive/aspasie-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - ASPASIE",
      "width": 800,
      "height": 800,
      "download": {
        "type": "download",
        "label": "Download Aspasie",
        "url": "https://drive.google.com/uc?export=download&id=1yDr4qC5CsJSSOGsl3JV1k93-Wn8fHWIH"
      }
    },
    {
      "id": "cerises",
      "title": "CERISES",
      "editKey": "album_cerises",
      "page": "music/cerises-infra.html",
      "thumb": "assets/music/responsive/cerises-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - CERISES",
      "width": 800,
      "height": 800
    },
    {
      "id": "ldc13",
      "title": "LDC13",
      "editKey": "album_ldc13",
      "page": "music/ldc13-infra.html",
      "thumb": "assets/music/responsive/ldc13-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - LDC13",
      "width": 800,
      "height": 800
    },
    {
      "id": "moremi-ajasoro",
      "title": "MOREMI AJASORO",
      "editKey": "album_moremi_ajasoro",
      "page": "music/moremi-ajasoro-infra.html",
      "thumb": "assets/music/responsive/moremi-ajasoro-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - MOREMI AJASORO",
      "width": 800,
      "height": 800
    },
    {
      "id": "gaia",
      "title": "GAIA",
      "editKey": "album_gaia",
      "page": "music/gaia-infra.html",
      "thumb": "assets/music/responsive/gaia-cover-1200.webp",
      "thumbAlt": "Cover GAIA - INFRA.",
      "width": 800,
      "height": 800,
      "download": {
        "type": "download",
        "label": "Download Gaia",
        "url": "https://drive.google.com/uc?export=download&id=18EGtIO_-bwDri6yX_VKl_XFBbYC8Qm2I"
      }
    },
    {
      "id": "mami-wata",
      "title": "MAMI WATA",
      "editKey": "album_mami_wata",
      "page": "music/mami-wata-infra.html",
      "thumb": "assets/music/responsive/mami-wata-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - MAMI WATA",
      "width": 800,
      "height": 800,
      "download": {
        "type": "download",
        "label": "Download Mami Wata",
        "url": "https://drive.google.com/uc?export=download&id=18vMDtTb_h0dcpvEsUZZ4Q27kfoz6AJEh"
      }
    },
    {
      "id": "adc-13",
      "title": "ADC13",
      "editKey": "album_adc_13",
      "page": "music/adc-13-infra.html",
      "thumb": "assets/music/responsive/adc-13-6e983f31-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - ADC 13",
      "width": 800,
      "height": 800,
      "download": {
        "type": "download",
        "label": "Download ADC 13",
        "url": "https://drive.google.com/uc?export=download&id=1j9AZDjm090tLcgrqRJ5skPEkKywhDu_e"
      }
    },
    {
      "id": "abricot",
      "title": "ABRICOTS",
      "editKey": "album_abricot",
      "page": "music/abricot-infra.html",
      "thumb": "assets/music/responsive/abricot-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - ABRICOT",
      "width": 800,
      "height": 800,
      "download": {
        "type": "download",
        "label": "Download Abricot",
        "url": "https://drive.google.com/uc?export=download&id=1jnaysfOtLXW-xtkvSemsoOuf6ImYYdq1"
      }
    },
    {
      "id": "peches",
      "title": "PECHES",
      "editKey": "album_peches",
      "page": "music/peches-infra.html",
      "thumb": "assets/music/responsive/peches-cover-1200.webp",
      "thumbAlt": "Cover INFRA. - PECHES",
      "width": 800,
      "height": 800
    }
  ],
  "clips": [
    {
      "id": "clip-1",
      "title": "FREEZE CORLEONE - CHEN LADEN (INFRA. MIX)",
      "editKey": "clip_1",
      "youtubeUrl": "https://www.youtube.com/watch?v=_JeILYHPjWE"
    },
    {
      "id": "clip-2",
      "title": "FREEZE CORLEONE - VOLDEMORT (INFRA. MIX)",
      "editKey": "clip_2",
      "youtubeUrl": "https://www.youtube.com/watch?v=fLcdQLtVt90"
    }
  ]
};

  const globalObject = typeof window !== "undefined"
    ? window
    : typeof self !== "undefined"
      ? self
      : globalThis;

  globalObject.InfraFallbackCatalog = fallbackCatalog;
})();
