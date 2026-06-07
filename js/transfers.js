import App from "./app.js";

App.transfers = {
  failedAvatarUrls: new Set(),

  isTransferWindowLocked() {
    if (App.config.transferWindowLocked === true) return true;

    const openUntil = App.config.transferWindowOpenUntil;
    if (!openUntil) return false;

    const deadline = new Date(openUntil);
    return !Number.isNaN(deadline.getTime()) && Date.now() > deadline.getTime();
  },

  getTransferWindowLockMessage() {
    return (
      App.config.transferWindowLockedMessage ||
      "Janela de transferências fechada enquanto consolidamos o app."
    );
  },

  syncTransferWindowLock() {
    const locked = App.transfers.isTransferWindowLocked();
    const view = document.getElementById("transfersView");
    const form = document.getElementById("transferForm");

    view?.classList.toggle("is-transfer-window-locked", locked);
    if (!form) return;

    form.querySelectorAll("input, select, textarea, button").forEach((field) => {
      field.disabled = locked;
    });

    if (locked) App.transfers.renderTransferPreview(form);
  },

  femaleRatingNames: [
    "Alexia Putellas",
    "Aitana Bonmatí",
    "Caroline Graham Hansen",
    "Alessia Russo",
    "Mariona",
    "Patri Guijarro",
    "Khadija Shaw",
    "Mapi León",
    "Marie Katoto",
    "Kadidiatou Diani",
    "Sophia Wilson",
    "Guro Reiten",
    "Ewa Pajor",
    "Christiane Endler",
    "Debinha",
    "Irene Paredes",
    "Chloe Kelly",
    "Lindsey Heaps",
    "Lucy Bronze",
    "Rose Lavelle",
    "Sakina Karchaoui",
    "Leah Williamson",
    "Beth Mead",
    "Mallory Swanson",
    "Ada Hegerberg",
    "Lauren Hemp",
    "Millie Bright",
    "Katie McCabe",
    "Sam Kerr",
    "Ann-Katrin Berger",
    "Grace Geyoro",
    "Claudia Pina",
    "Klara Bühl",
    "Ona Batlle",
    "Lea Schüller",
    "Melchie Dumornay",
    "Pernille Harder",
  ],

  manualMarketValues: {
    "lucas torreira": 10000000,
  },

  manualPlayerAvatarOverrides: [
    {
      name: "Jeremie Frimpong",
      avatar_url:
        "https://img.a.transfermarkt.technology/portrait/big/484547-1689710682.jpg?lm=1",
      source_url:
        "https://www.transfermarkt.co.uk/jeremie-frimpong/profil/spieler/484547",
      source_name: "Transfermarkt portrait override",
    },
    {
      name: "Gabriel Silva",
      club: "Sporting Clube de Portugal",
      requiresClub: true,
      avatar_url:
        "https://img.a.transfermarkt.technology/portrait/big/1006454-1771959088.jpg?lm=1",
      source_url:
        "https://www.transfermarkt.co.uk/gabriel-silva/profil/spieler/1006454",
      source_name: "Transfermarkt portrait override",
    },
    {
      name: "Talisca",
      avatar_url:
        "https://img.a.transfermarkt.technology/portrait/big/258626-1738664288.jpg?lm=1",
      source_url:
        "https://www.transfermarkt.co.uk/talisca/profil/spieler/258626",
      source_name: "Transfermarkt portrait override",
    },
    {
      name: "Barış Alper Yılmaz",
      avatar_url: "https://cdn.sofifa.net/players/263/205/26_240.png",
      source_url: "https://sofifa.com/player/263205/baris-alper-yilmaz",
      source_name: "SoFIFA portrait override",
    },
    {
      name: "Paul Pogba",
      avatar_url: "https://cdn.sofifa.net/players/195/864/26_240.png",
      source_url: "https://sofifa.com/player/195864/paul-pogba",
      source_name: "SoFIFA FC 26 portrait override",
    },
    {
      name: "Timo Werner",
      avatar_url: "https://cdn.sofifa.net/players/212/188/26_240.png",
      source_url: "https://sofifa.com/player/212188/timo-werner",
      source_name: "SoFIFA FC 26 portrait override",
    },
    {
      name: "Johan Mojica",
      avatar_url: "https://cdn.sofifa.net/players/214/026/26_240.png",
      source_url: "https://sofifa.com/player/214026/johan-mojica",
      source_name: "SoFIFA FC 26 portrait override",
    },
    {
      name: "Xherdan Shaqiri",
      avatar_url: "https://cdn.sofifa.net/players/183/711/26_240.png",
      source_url: "https://sofifa.com/player/183711/xherdan-shaqiri",
      source_name: "SoFIFA FC 26 portrait override",
    },
    {
      name: "N'Golo Kante",
      avatar_url: "https://cdn.sofifa.net/players/215/914/26_240.png",
      source_url: "https://sofifa.com/player/215914/ngolo-kante",
      source_name: "SoFIFA FC 26 portrait override",
    },
    {
      name: "Leandro Paredes",
      avatar_url: "https://cdn.sofifa.net/players/207/439/26_240.png",
      source_url: "https://sofifa.com/player/207439/leandro-paredes",
      source_name: "SoFIFA FC 26 portrait override",
    },
    {
      name: "Stephan El Shaarawy",
      avatar_url: "https://cdn.sofifa.net/players/190/813/26_240.png",
      source_url: "https://sofifa.com/player/190813/stephan-el-shaarawy",
      source_name: "SoFIFA FC 26 portrait override",
    },
  ],

  manualPlayerRatings: {
    talisca: {
      name: "Talisca",
      club: "Fenerbahce",
      position: "CAM",
      nation: "Brazil",
      overall: 81,
      gender: "Men's Football",
      avatar_url:
        "https://img.a.transfermarkt.technology/portrait/big/258626-1738664288.jpg?lm=1",
      source_url:
        "https://www.transfermarkt.co.uk/talisca/profil/spieler/258626",
      source_name: "Manual rating fallback + Transfermarkt portrait",
    },
    "david de gea": {
      name: "David De Gea Quintana",
      club: "Fiorentina",
      position: "GK",
      nation: "Spain",
      overall: 85,
      gender: "Men's Football",
      avatar_url: "https://cdn.sofifa.net/players/193/080/26_240.png",
      source_url: "https://sofifa.com/player/193080/david-de-gea",
      source_name: "EA SPORTS FC official ratings + SoFIFA headshot",
    },
    "david de gea quintana": {
      name: "David De Gea Quintana",
      club: "Fiorentina",
      position: "GK",
      nation: "Spain",
      overall: 85,
      gender: "Men's Football",
      avatar_url: "https://cdn.sofifa.net/players/193/080/26_240.png",
      source_url: "https://sofifa.com/player/193080/david-de-gea",
      source_name: "EA SPORTS FC official ratings + SoFIFA headshot",
    },
    "leonardo spinazzola": {
      name: "Leonardo Spinazzola",
      club: "Società Sportiva Calcio Napoli",
      position: "LB",
      nation: "Italy",
      overall: 80,
      gender: "Men's Football",
      avatar_url: "https://cdn.sofifa.net/players/202/884/26_240.png",
      source_url: "https://sofifa.com/player/202884/leonardo-spinazzola",
      source_name: "EA SPORTS FC official ratings + SoFIFA headshot",
    },
    "stefan de vrij": {
      name: "Stefan de Vrij",
      club: "Football Club Internazionale Milano S.p.A.",
      position: "CB",
      nation: "Netherlands",
      overall: 80,
      gender: "Men's Football",
      avatar_url: "https://cdn.sofifa.net/players/198/176/26_240.png",
      source_url: "https://sofifa.com/player/198176/stefan-de-vrij",
      source_name: "EA SPORTS FC official ratings + SoFIFA headshot",
    },
    "lucas torreira": {
      name: "Lucas Torreira",
      club: "Galatasaray Spor Kulübü",
      position: "CDM",
      nation: "Uruguay",
      overall: 82,
      gender: "Men's Football",
      avatar_url: "https://cdn.sofifa.net/players/223/959/26_240.png",
      source_url: "https://sofifa.com/player/223959/lucas-torreira",
      source_name: "EA SPORTS FC official ratings + SoFIFA headshot",
    },
    "lukas klostermann": {
      name: "Lukas Klostermann",
      club: "RasenBallsport Leipzig",
      position: "CB",
      nation: "Germany",
      overall: 79,
      gender: "Men's Football",
      avatar_url:
        "https://www.fifaratings.com/wp-content/uploads/lukas-klostermann-fc-rating.png",
      source_url: "https://www.fifaratings.com/lukas-klostermann",
      source_name: "FIFA Ratings normal FC ratings",
    },
    dybala: {
      name: "Paulo Dybala",
      club: "Roma",
      position: "CAM",
      nation: "Argentina",
      overall: 86,
      gender: "Men's Football",
      avatar_url:
        "https://www.fifaratings.com/wp-content/uploads/paulo-dybala-fc-rating-300x300.png",
      source_url: "https://www.fifaratings.com/paulo-dybala",
      source_name: "FIFA Ratings normal FC ratings",
    },
    "paulo dybala": {
      name: "Paulo Dybala",
      club: "Roma",
      position: "CAM",
      nation: "Argentina",
      overall: 86,
      gender: "Men's Football",
      avatar_url:
        "https://www.fifaratings.com/wp-content/uploads/paulo-dybala-fc-rating-300x300.png",
      source_url: "https://www.fifaratings.com/paulo-dybala",
      source_name: "FIFA Ratings normal FC ratings",
    },
    "henrikh mkhitaryan": {
      name: "Henrikh Mkhitaryan",
      club: "Football Club Internazionale Milano S.p.A.",
      position: "CAM",
      nation: "Armenia",
      overall: 83,
      gender: "Men's Football",
      avatar_url:
        "https://www.fifaratings.com/wp-content/uploads/henrikh-mkhitaryan-fc-rating-300x300.png",
      source_url: "https://www.fifaratings.com/henrikh-mkhitaryan",
      source_name: "FIFA Ratings normal FC ratings",
    },
    mkhitaryan: {
      name: "Henrikh Mkhitaryan",
      club: "Football Club Internazionale Milano S.p.A.",
      position: "CAM",
      nation: "Armenia",
      overall: 83,
      gender: "Men's Football",
      avatar_url:
        "https://www.fifaratings.com/wp-content/uploads/henrikh-mkhitaryan-fc-rating-300x300.png",
      source_url: "https://www.fifaratings.com/henrikh-mkhitaryan",
      source_name: "FIFA Ratings normal FC ratings",
    },
    "reinildo mandava": {
      name: "Reinildo Mandava",
      club: "Sunderland",
      position: "LB",
      nation: "Mozambique",
      overall: 79,
      gender: "Men's Football",
      avatar_url:
        "https://www.fifaratings.com/wp-content/uploads/reinildo-isnard-mandava-fc-rating-300x300.png",
      source_url: "https://www.fifaratings.com/reinildo-isnard-mandava",
      source_name: "FIFA Ratings normal FC ratings",
    },
    "reinildo isnard mandava": {
      name: "Reinildo Mandava",
      club: "Sunderland",
      position: "LB",
      nation: "Mozambique",
      overall: 79,
      gender: "Men's Football",
      avatar_url:
        "https://www.fifaratings.com/wp-content/uploads/reinildo-isnard-mandava-fc-rating-300x300.png",
      source_url: "https://www.fifaratings.com/reinildo-isnard-mandava",
      source_name: "FIFA Ratings normal FC ratings",
    },
    reinildo: {
      name: "Reinildo Mandava",
      club: "Sunderland",
      position: "LB",
      nation: "Mozambique",
      overall: 79,
      gender: "Men's Football",
      avatar_url:
        "https://www.fifaratings.com/wp-content/uploads/reinildo-isnard-mandava-fc-rating-300x300.png",
      source_url: "https://www.fifaratings.com/reinildo-isnard-mandava",
      source_name: "FIFA Ratings normal FC ratings",
    },
    "sadio mane": {
      name: "Sadio Mané",
      club: "Al-Nassr Football Club",
      position: "LM",
      nation: "Senegal",
      overall: 83,
      gender: "Men's Football",
      avatar_url:
        "https://www.fifaratings.com/wp-content/uploads/sadio-mane-fc-rating-300x300.png",
      source_url: "https://www.fifaratings.com/sadio-mane",
      source_name: "FIFA Ratings normal FC ratings",
    },
    "sadio mané": {
      name: "Sadio Mané",
      club: "Al-Nassr Football Club",
      position: "LM",
      nation: "Senegal",
      overall: 83,
      gender: "Men's Football",
      avatar_url:
        "https://www.fifaratings.com/wp-content/uploads/sadio-mane-fc-rating-300x300.png",
      source_url: "https://www.fifaratings.com/sadio-mane",
      source_name: "FIFA Ratings normal FC ratings",
    },
    mane: {
      name: "Sadio Mané",
      club: "Al-Nassr Football Club",
      position: "LM",
      nation: "Senegal",
      overall: 83,
      gender: "Men's Football",
      avatar_url:
        "https://www.fifaratings.com/wp-content/uploads/sadio-mane-fc-rating-300x300.png",
      source_url: "https://www.fifaratings.com/sadio-mane",
      source_name: "FIFA Ratings normal FC ratings",
    },
    mané: {
      name: "Sadio Mané",
      club: "Al-Nassr Football Club",
      position: "LM",
      nation: "Senegal",
      overall: 83,
      gender: "Men's Football",
      avatar_url:
        "https://www.fifaratings.com/wp-content/uploads/sadio-mane-fc-rating-300x300.png",
      source_url: "https://www.fifaratings.com/sadio-mane",
      source_name: "FIFA Ratings normal FC ratings",
    },
    "baris alper yilmaz": {
      name: "Barış Alper Yılmaz",
      club: "Galatasaray Spor Kulübü",
      position: "LM",
      nation: "Turkey",
      overall: 80,
      gender: "Men's Football",
      avatar_url: "https://cdn.sofifa.net/players/263/205/26_240.png",
      source_url: "https://sofifa.com/player/263205/baris-alper-yilmaz",
      source_name: "SoFIFA FC 26 headshot",
    },
    marquinhos: {
      name: "Marquinhos",
      club: "Paris SG",
      position: "CB",
      nation: "Brazil",
      overall: 87,
      gender: "Men's Football",
      avatar_url: "https://cdn.sofifa.net/players/207/865/26_240.png",
      source_url: "https://sofifa.com/player/207865/marquinhos",
      source_name: "SoFIFA FC 26 headshot",
    },
    "theo hernandez": {
      name: "Theo Hernandez",
      club: "Al Hilal",
      position: "LB",
      nation: "France",
      overall: 84,
      gender: "Men's Football",
      avatar_url: "https://cdn.sofifa.net/players/232/656/26_240.png",
      source_url: "https://sofifa.com/player/232656/theo-hernandez",
      source_name: "SoFIFA FC 26 headshot",
    },
    "marcos llorente": {
      name: "Marcos Llorente Moreno",
      club: "Atletico de Madrid",
      position: "RB",
      nation: "Spain",
      overall: 84,
      gender: "Men's Football",
      avatar_url: "https://cdn.sofifa.net/players/226/161/26_240.png",
      source_url: "https://sofifa.com/player/226161/marcos-llorente-moreno",
      source_name: "SoFIFA FC 26 headshot",
    },
    "marcos llorente moreno": {
      name: "Marcos Llorente Moreno",
      club: "Atletico de Madrid",
      position: "RB",
      nation: "Spain",
      overall: 84,
      gender: "Men's Football",
      avatar_url: "https://cdn.sofifa.net/players/226/161/26_240.png",
      source_url: "https://sofifa.com/player/226161/marcos-llorente-moreno",
      source_name: "SoFIFA FC 26 headshot",
    },
    "hakan calhanoglu": {
      name: "Hakan Çalhanoğlu",
      club: "Football Club Internazionale Milano S.p.A.",
      position: "CDM",
      nation: "Turkey",
      overall: 86,
      gender: "Men's Football",
      avatar_url: "https://cdn.sofifa.net/players/208/128/26_240.png",
      source_url: "https://sofifa.com/player/208128/hakan-calhanoglu",
      source_name: "SoFIFA FC 26 headshot",
    },
    "hakan çalhanoglu": {
      name: "Hakan Çalhanoğlu",
      club: "Football Club Internazionale Milano S.p.A.",
      position: "CDM",
      nation: "Turkey",
      overall: 86,
      gender: "Men's Football",
      avatar_url: "https://cdn.sofifa.net/players/208/128/26_240.png",
      source_url: "https://sofifa.com/player/208128/hakan-calhanoglu",
      source_name: "SoFIFA FC 26 headshot",
    },
    "alvaro garcia": {
      name: "Álvaro García",
      club: "Rayo Vallecano de Madrid S.A.D.",
      position: "LM",
      nation: "Spain",
      overall: 81,
      gender: "Men's Football",
      avatar_url: "https://cdn.sofifa.net/players/216/447/26_240.png",
      source_url: "https://sofifa.com/player/216447/alvaro-garcia-rivera",
      source_name: "SoFIFA FC 26 headshot",
    },
    "alvaro garcia rivera": {
      name: "Álvaro García",
      club: "Rayo Vallecano de Madrid S.A.D.",
      position: "LM",
      nation: "Spain",
      overall: 81,
      gender: "Men's Football",
      avatar_url: "https://cdn.sofifa.net/players/216/447/26_240.png",
      source_url: "https://sofifa.com/player/216447/alvaro-garcia-rivera",
      source_name: "SoFIFA FC 26 headshot",
    },
    neymar: {
      name: "Neymar Jr",
      club: "Santos Futebol Clube",
      position: "CAM",
      nation: "Brazil",
      overall: 82,
      gender: "Men's Football",
      avatar_url: "https://cdn.sofifa.net/players/190/871/25_240.png",
      source_url: "https://sofifa.com/player/190871/neymar-da-silva-santos-jr",
      source_name: "SoFIFA headshot fallback",
    },
    "neymar jr": {
      name: "Neymar Jr",
      club: "Santos Futebol Clube",
      position: "CAM",
      nation: "Brazil",
      overall: 82,
      gender: "Men's Football",
      avatar_url: "https://cdn.sofifa.net/players/190/871/25_240.png",
      source_url: "https://sofifa.com/player/190871/neymar-da-silva-santos-jr",
      source_name: "SoFIFA headshot fallback",
    },
    isco: {
      name: "Isco",
      club: "Real Betis",
      position: "CAM",
      nation: "Spain",
      overall: 84,
      gender: "Men's Football",
      avatar_url: "https://cdn.sofifa.net/players/197/781/26_240.png",
      source_url:
        "https://sofifa.com/player/197781/francisco-roman-alarcon-suarez",
      source_name: "SoFIFA FC 26 headshot",
    },
    "nicolas pepe": {
      name: "Nicolas Pépé",
      club: "Villarreal Club de Fútbol S.A.D.",
      position: "RM",
      nation: "Ivory Coast",
      overall: 78,
      gender: "Men's Football",
      avatar_url: "https://cdn.sofifa.net/players/226/110/26_240.png",
      source_url: "https://sofifa.com/player/226110/nicolas-pepe",
      source_name: "SoFIFA FC 26 headshot",
    },
  },

  isPlayableRating(player) {
    const gender = App.utils.normalizeText(player?.gender || "");
    const name = App.utils.normalizeText(player?.name || "");
    if (gender.includes("women") || gender.includes("femin")) return false;
    return !App.transfers.femaleRatingNames.some(
      (item) => App.utils.normalizeText(item) === name,
    );
  },

  isUsablePlayerAvatar(url) {
    const normalized = App.utils.normalizeText(url || "");
    if (!normalized) return false;
    return (
      !normalized.includes("player_man") &&
      !normalized.includes("player-woman") &&
      !normalized.includes("player woman") &&
      !normalized.includes("player-man")
    );
  },

  getManualPlayerRating(playerName) {
    const keys = App.transfers
      .getPlayerSearchAliases(playerName)
      .map(App.transfers.normalizePlayerRatingKey);
    const manualKey = keys.find(
      (key) => App.transfers.manualPlayerRatings[key],
    );
    return manualKey ? App.transfers.manualPlayerRatings[manualKey] : null;
  },

  getManualPlayerAvatarOverride(playerName, context = {}) {
    const keys = App.transfers
      .getPlayerSearchAliases(playerName)
      .map(App.transfers.normalizePlayerRatingKey);
    const clubKey = App.utils.normalizeText(
      context?.club || context?.fromClub || context?.clubName || "",
    );

    return (
      App.transfers.manualPlayerAvatarOverrides.find((item) => {
        const nameKey = App.transfers.normalizePlayerRatingKey(item.name);
        const itemClubKey = App.utils.normalizeText(item.club || "");
        if (!keys.includes(nameKey)) return false;
        if (item.requiresClub && (!clubKey || itemClubKey !== clubKey)) {
          return false;
        }
        return !itemClubKey || !clubKey || itemClubKey === clubKey;
      }) || null
    );
  },

  applyManualRatingFallback(rating, playerName) {
    const manual = App.transfers.getManualPlayerRating(playerName);
    if (!manual) return rating || null;
    if (!rating) return manual;
    const ratingHasUsableAvatar = App.transfers.isUsablePlayerAvatar(
      rating.avatar_url,
    );
    const avatarSource = App.utils.normalizeText(
      `${rating.avatar_url || ""} ${rating.source_name || ""}`,
    );
    const shouldReplaceStaleAvatar =
      ratingHasUsableAvatar &&
      manual.avatar_url &&
      avatarSource.includes("wikimedia");
    if (ratingHasUsableAvatar && !shouldReplaceStaleAvatar) return rating;
    return {
      ...manual,
      ...rating,
      avatar_url: manual.avatar_url || rating.avatar_url,
      source_url: shouldReplaceStaleAvatar
        ? manual.source_url
        : rating.source_url || manual.source_url,
      source_name: shouldReplaceStaleAvatar
        ? manual.source_name
        : rating.source_name || manual.source_name,
    };
  },

  getPlayerSearchAliases(playerName) {
    const cleanName = App.transfers.sanitizePlayerSearchText(playerName);
    const normalized = App.utils.normalizeText(cleanName);
    const ratingKey = App.transfers.normalizePlayerRatingKey(cleanName);
    const aliases = {
      "vinicius junior": ["Vini Jr.", "Vinicius Jose de Oliveira Junior"],
      "vinicius jr": ["Vini Jr.", "Vinicius Jose de Oliveira Junior"],
      mbappe: ["Kylian Mbappe", "Kylian Mbappé"],
      "kylian mbappe": ["Kylian Mbappé"],
      dembele: ["Ousmane Dembele", "Ousmane Dembélé"],
      "lautaro martinez": ["Lautaro Martínez"],
      "ruben dias": ["Rúben Dias"],
      neymar: ["Neymar Jr."],
      "kyle walker": ["Kyle Andrew Walker"],
      "heung-min son": ["Heung Min Son"],
      "heung min son": ["Heung-Min Son"],
      "david de gea": ["David De Gea Quintana"],
      kante: ["N'Golo Kante", "N’Golo Kante", "Ngolo Kante"],
      "n'golo kante": ["N'Golo Kante", "N’Golo Kante", "Ngolo Kante"],
      "n golo kante": ["N'Golo Kante", "N’Golo Kante", "Ngolo Kante"],
      "ngolo kante": ["N'Golo Kante", "N’Golo Kante"],
      "inaki williams": ["Iñaki Williams", "Inaki Williams Arthuer"],
      malcom: ["Malcom Filipe Silva de Oliveira"],
      "roger ibanez": ["Roger Ibanez Da Silva"],
      "davinson sanchez": ["Davinson Sanchez"],
      "cristiano ronaldo": ["Cristiano Ronaldo dos Santos Aveiro"],
      "leandro paredes": ["Leandro Paredes"],
      dybala: ["Paulo Dybala"],
      mkhitaryan: ["Henrikh Mkhitaryan"],
      reinildo: ["Reinildo Mandava", "Reinildo Isnard Mandava"],
      "reinildo mandava": ["Reinildo", "Reinildo Isnard Mandava"],
      "sadio mane": ["Sadio Mané"],
      "sadio mané": ["Sadio Mane"],
      mane: ["Sadio Mané", "Sadio Mane"],
      mané: ["Sadio Mane", "Sadio Mané"],
      "baris alper yilmaz": ["Barış Alper Yılmaz", "B. Yılmaz"],
      "barış alper yılmaz": ["Baris Alper Yilmaz", "B. Yilmaz"],
      "theo hernandez": ["Theo Hernández"],
      "theo hérnandez": ["Theo Hernandez"],
      "marcos llorente": ["Marcos Llorente Moreno"],
      shaqiri: ["Xherdan Shaqiri"],
      ricohenry: ["Rico Henry"],
      gonzaloplata: ["Gonzalo Plata"],
      "nicolas pepe": ["Nicolas Pépé"],
      "nicolas pépé": ["Nicolas Pepe"],
    };

    return [cleanName, ...(aliases[normalized] || aliases[ratingKey] || [])].filter(
      Boolean,
    );
  },

  sanitizePlayerSearchText(value = "") {
    return String(value || "")
      .replace(/&#8217;|&#x2019;|&#39;|&apos;/gi, "'")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/[’‘`´]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  },

  normalizePlayerRatingKey(value) {
    return App.utils
      .normalizeText(App.transfers.sanitizePlayerSearchText(value))
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  },

  isTrustedPlayerNameMatch(aliasKey, candidateKey) {
    if (!aliasKey || !candidateKey) return false;
    if (aliasKey === candidateKey) return true;

    const aliasTokens = aliasKey.split(" ").filter(Boolean);
    const candidateTokens = candidateKey.split(" ").filter(Boolean);
    const shorter =
      aliasTokens.length <= candidateTokens.length
        ? aliasTokens
        : candidateTokens;
    const longer =
      aliasTokens.length <= candidateTokens.length
        ? candidateTokens
        : aliasTokens;
    const shorterKey = shorter.join(" ");
    const longerKey = longer.join(" ");

    if (!shorterKey || !longerKey.startsWith(`${shorterKey} `)) return false;

    return shorter.length >= 2;
  },

  getMarketPlayerNameComparableKeys(value = "") {
    const key = App.transfers.normalizePlayerRatingKey(value);
    if (!key) return [];

    const variants = new Set([key]);
    const tokens = key.split(" ").filter(Boolean);
    const suffixes = new Set(["jr", "junior"]);

    if (tokens.length > 1 && suffixes.has(tokens[tokens.length - 1])) {
      variants.add(tokens.slice(0, -1).join(" "));
    }

    return [...variants].filter(Boolean);
  },

  isMarketPlayerNameVariantMatch(left = "", right = "") {
    const leftKeys = App.transfers.getMarketPlayerNameComparableKeys(left);
    const rightKeys = App.transfers.getMarketPlayerNameComparableKeys(right);
    return leftKeys.some((leftKey) => rightKeys.includes(leftKey));
  },

  getMarketPlayerValue(player) {
    const key = App.transfers.normalizePlayerRatingKey(player?.name);
    const override = App.transfers.manualMarketValues[key];
    if (override !== undefined) return Number(override);
    const directValue = Number(player?.market_value_eur || player?.marketValue || 0);
    if (directValue > 0) {
      return directValue;
    }
    return 0;
  },

  hasVerifiedTransfermarktValue(player = {}) {
    const key = App.transfers.normalizePlayerRatingKey(player?.name);
    if (App.transfers.manualMarketValues[key] !== undefined) return true;
    const directValue = Number(player?.market_value_eur || player?.marketValue || 0);
    if (directValue <= 0) return false;
    const transfermarktUrl = String(
      player?.transfermarkt_url || player?.transfermarktUrl || "",
    ).trim();
    const source = App.utils.normalizeText(
      player?.source ||
        player?.source_name ||
        player?.sourceName ||
        player?.marketValueSource ||
        "",
    );

    return (
      transfermarktUrl.includes("transfermarkt") ||
      source.includes("transfermarkt")
    );
  },

  formatMarketValueDisplay(value = 0, fallback = "TM pendente") {
    return Number(value || 0) > 0
      ? App.utils.formatCurrency(Number(value || 0))
      : fallback;
  },

  isRatingOnlyMarketPlayer(player = {}) {
    const source = App.utils.normalizeText(
      [
        player?.source,
        player?.syntheticSource,
        player?.marketValueSource,
      ]
        .filter(Boolean)
        .join(" "),
    );
    return Boolean(
      player?.isRatingOnly ||
        source.includes("ea rating") ||
        source.includes("ea_rating"),
    );
  },

  formatMarketPlayerValueDisplay(player = {}) {
    const marketValue = App.transfers.getMarketPlayerValue(player);
    if (marketValue > 0) {
      return App.transfers.formatMarketValueDisplay(marketValue);
    }
    return App.transfers.isRatingOnlyMarketPlayer(player)
      ? "Sem cotacao TM"
      : App.transfers.formatMarketValueDisplay(marketValue);
  },

  parseTransfermarktMarketValue(raw = "") {
    const text = String(raw || "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, "")
      .toLowerCase();
    const match = text.match(/\u20ac([\d.,]+)(bn|m|k|th\.)?/i);
    if (!match) return 0;

    const normalizedNumber =
      match[1].includes(",") && match[1].includes(".")
        ? match[1].replace(/,/g, "")
        : match[1].replace(",", ".");
    const amount = Number(normalizedNumber);
    if (!Number.isFinite(amount)) return 0;

    const suffix = match[2] || "";
    if (suffix === "bn") return Math.round(amount * 1000000000);
    if (suffix === "m") return Math.round(amount * 1000000);
    if (suffix === "k" || suffix === "th.") return Math.round(amount * 1000);
    return Math.round(amount);
  },

  stripTransfermarktMarkdown(value = "") {
    return String(value || "")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  },

  getTransfermarktReaderUrl(url = "") {
    return `https://r.jina.ai/http://${String(url || "").trim()}`;
  },

  getTransfermarktSearchUrl(query = "") {
    return `https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(String(query || "").trim())}`;
  },

  getTransfermarktCandidateScore(player = {}, candidate = {}) {
    const playerKey = App.transfers.normalizePlayerRatingKey(player.name || "");
    const candidateKey = App.transfers.normalizePlayerRatingKey(
      candidate.name || "",
    );
    if (!playerKey || !candidateKey) return 0;

    let score = 0;
    if (playerKey === candidateKey) {
      score += 100;
    } else if (
      App.transfers.isTrustedPlayerNameMatch(playerKey, candidateKey) ||
      App.transfers.isTrustedPlayerNameMatch(candidateKey, playerKey)
    ) {
      score += 72;
    } else if (
      candidateKey.includes(playerKey) ||
      playerKey.includes(candidateKey)
    ) {
      score += 55;
    }

    const playerClub = App.utils.normalizeText(player.club || "");
    const candidateClub = App.utils.normalizeText(candidate.club || "");
    if (playerClub && candidateClub) {
      if (playerClub === candidateClub) score += 35;
      else if (
        candidateClub.includes(playerClub) ||
        playerClub.includes(candidateClub)
      ) {
        score += 24;
      }
    }

    if (candidate.marketValue > 0) score += 10;
    if (candidate.transfermarktUrl) score += 8;
    return score;
  },

  extractTransfermarktSearchCandidates(markdown = "") {
    const rows = String(markdown || "")
      .split(/\r?\n/)
      .filter(
        (line) =>
          line.includes("/profil/spieler/") &&
          line.includes("|") &&
          !line.includes("Search results for agents"),
      );

    return rows
      .map((line) => {
        const playerLinks = [
          ...line.matchAll(
            /\[([^\]]+)\]\((https:\/\/www\.transfermarkt\.com\/[^)\s"]+\/profil\/spieler\/(\d+))[^)]*\)/g,
          ),
        ].filter((match) => !/^image\s/i.test(match[1]));
        const playerLink = playerLinks[0];
        if (!playerLink) return null;

        const clubLinks = [
          ...line.matchAll(
            /\[([^\]]+)\]\((https:\/\/www\.transfermarkt\.com\/[^)\s"]+\/startseite\/verein\/\d+)[^)]*\)/g,
          ),
        ].filter((match) => !/^image\s/i.test(match[1]));
        const cells = line
          .split("|")
          .map((cell) => App.transfers.stripTransfermarktMarkdown(cell));
        const valueCell = cells.find((cell) => /\u20ac/.test(cell)) || "";
        const ageCell = cells.find((cell) => /^\d{2}$/.test(cell)) || "";

        return {
          name: App.transfers.stripTransfermarktMarkdown(playerLink[1]),
          transfermarktUrl: playerLink[2],
          transfermarktId: playerLink[3],
          club: clubLinks[0]?.[1] || "",
          position: cells.find((cell) => /^[A-Z]{1,4}$/.test(cell)) || "",
          age: Number(ageCell || 0),
          marketValue: App.transfers.parseTransfermarktMarketValue(valueCell),
        };
      })
      .filter(Boolean);
  },

  extractTransfermarktProfileValue(markdownOrHtml = "") {
    const text = String(markdownOrHtml || "");
    const focused =
      text.match(/(?:Current market value|Market value|Last update)[\s\S]{0,300}?(\u20ac\s*[\d.,]+\s*(?:bn|m|k|th\.)?)/i)?.[1] ||
      text.match(/(\u20ac\s*[\d.,]+\s*(?:bn|m|k|th\.)?)\s*Last update/i)?.[1] ||
      "";
    const focusedValue = App.transfers.parseTransfermarktMarketValue(focused);
    if (focusedValue > 0) return focusedValue;

    const firstValue = text.match(/\u20ac\s*[\d.,]+\s*(?:bn|m|k|th\.)?/i)?.[0] || "";
    return App.transfers.parseTransfermarktMarketValue(firstValue);
  },

  async fetchTextWithTimeout(url = "", timeoutMs = 12000) {
    const headers = { "accept-language": "en-US,en;q=0.9,pt-BR;q=0.8" };
    const apiFetcher = App.api?.fetchWithTimeout;
    const response =
      typeof apiFetcher === "function"
        ? await apiFetcher(url, { headers }, timeoutMs)
        : await new Promise((resolve, reject) => {
            if (typeof fetch !== "function") {
              reject(new Error("Fetch indisponivel para consulta Transfermarkt"));
              return;
            }
            const controller =
              typeof AbortController === "function"
                ? new AbortController()
                : null;
            const timer =
              controller && typeof setTimeout === "function"
                ? setTimeout(
                    () => controller.abort(),
                    Math.max(1000, Number(timeoutMs || 12000)),
                  )
                : null;
            fetch(url, {
              headers,
              signal: controller?.signal,
            })
              .then(resolve)
              .catch(reject)
              .finally(() => {
                if (timer) clearTimeout(timer);
              });
          });
    if (!response.ok) {
      throw new Error(`Transfermarkt respondeu ${response.status}`);
    }
    return await response.text();
  },

  async resolveTransfermarktMarketPlayer(player = {}) {
    const name = String(player.name || "").trim();
    if (!name) return null;

    const existingValue = App.transfers.getMarketPlayerValue(player);
    const existingUrl = String(
      player.transfermarkt_url || player.transfermarktUrl || "",
    ).trim();
    if (existingValue > 0 && existingUrl) return player;

    const cacheKey = [
      App.transfers.normalizePlayerRatingKey(name),
      App.utils.normalizeText(player.club || ""),
    ].join("|");
    App.transfers.transfermarktLookupCache =
      App.transfers.transfermarktLookupCache || {};
    const cached = App.transfers.transfermarktLookupCache[cacheKey];
    if (cached && Date.now() - cached.at < 24 * 60 * 60000) {
      return cached.player;
    }

    try {
      const buildResolved = (transfermarktData = {}, marketValue = 0) => ({
        ...player,
        id: player.id || `tm-live:${transfermarktData.transfermarktId || name}`,
        isRatingOnly: false,
        syntheticSource: "",
        market_value_eur: marketValue,
        marketValue: marketValue,
        marketValueSource: "transfermarkt_live_lookup",
        transfermarkt_url: transfermarktData.transfermarktUrl || existingUrl,
        transfermarktId:
          transfermarktData.transfermarktId || player.transfermarktId || "",
        club: player.club || transfermarktData.club || "",
        original_club:
          player.original_club || player.club || transfermarktData.club || "",
        position: player.position || transfermarktData.position || "",
        age: Number(player.age || transfermarktData.age || 0),
        source: "transfermarkt_live_lookup",
        source_name: "Transfermarkt live lookup",
        source_url: transfermarktData.transfermarktUrl || existingUrl,
        last_synced_at: new Date().toISOString(),
      });

      if (existingUrl.includes("transfermarkt")) {
        const profileText = await App.transfers.fetchTextWithTimeout(
          App.transfers.getTransfermarktReaderUrl(existingUrl),
          10000,
        );
        const marketValue =
          App.transfers.extractTransfermarktProfileValue(profileText);
        if (marketValue > 0) {
          const resolved = buildResolved(
            {
              transfermarktUrl: existingUrl,
              transfermarktId:
                existingUrl.match(/\/spieler\/(\d+)/)?.[1] ||
                player.transfermarktId ||
                "",
            },
            marketValue,
          );
          App.transfers.transfermarktLookupCache[cacheKey] = {
            at: Date.now(),
            player: resolved,
          };
          return resolved;
        }
      }

      const searchUrl = App.transfers.getTransfermarktSearchUrl(name);
      const searchText = await App.transfers.fetchTextWithTimeout(
        App.transfers.getTransfermarktReaderUrl(searchUrl),
        14000,
      );
      const candidates =
        App.transfers.extractTransfermarktSearchCandidates(searchText);
      const best = candidates
        .map((candidate) => ({
          candidate,
          score: App.transfers.getTransfermarktCandidateScore(
            player,
            candidate,
          ),
        }))
        .filter((entry) => entry.score >= 82)
        .sort(
          (left, right) =>
            right.score - left.score ||
            Number(right.candidate.marketValue || 0) -
              Number(left.candidate.marketValue || 0),
        )[0]?.candidate;

      if (!best?.transfermarktUrl) {
        App.transfers.transfermarktLookupCache[cacheKey] = {
          at: Date.now(),
          player: null,
        };
        return null;
      }

      let marketValue = Number(best.marketValue || 0);
      if (marketValue <= 0) {
        const profileText = await App.transfers.fetchTextWithTimeout(
          App.transfers.getTransfermarktReaderUrl(best.transfermarktUrl),
          12000,
        );
        marketValue = App.transfers.extractTransfermarktProfileValue(profileText);
      }
      if (marketValue <= 0) return null;

      const resolved = buildResolved(best, marketValue);
      App.transfers.transfermarktLookupCache[cacheKey] = {
        at: Date.now(),
        player: resolved,
      };
      return resolved;
    } catch (error) {
      console.warn("Lookup Transfermarkt indisponivel:", error);
      App.transfers.transfermarktLookupCache[cacheKey] = {
        at: Date.now(),
        player: null,
      };
      return null;
    }
  },

  async hydrateMissingTransfermarktMarketPlayers(players = [], options = {}) {
    const rows = Array.isArray(players) ? players : [];
    if (!rows.length) return rows;

    let remainingLookups = Math.max(
      0,
      Number(options.maxLookups ?? rows.length),
    );
    const onlyRatingOnly = Boolean(options.onlyRatingOnly);

    return await Promise.all(
      rows.map(async (player) => {
        if (!player || App.transfers.hasVerifiedTransfermarktValue(player)) {
          return player;
        }
        if (
          onlyRatingOnly &&
          !App.transfers.isRatingOnlyMarketPlayer(player)
        ) {
          return player;
        }
        if (remainingLookups <= 0) return player;
        remainingLookups -= 1;
        return (await App.transfers.resolveTransfermarktMarketPlayer(player)) || player;
      }),
    );
  },

  async hydrateRatingOnlyMarketPlayersWithTransfermarkt(players = []) {
    return await App.transfers.hydrateMissingTransfermarktMarketPlayers(players, {
      onlyRatingOnly: true,
      maxLookups: Array.isArray(players) ? players.length : 0,
    });
  },

  getMarketTransfermarktLookupLimit(isSpecificNameSearch = false) {
    if (App.api?.isRateLimitedMarketQuery?.()) return 0;
    return isSpecificNameSearch ? 8 : 2;
  },

  getMarketSalaryLookupLimit(isSpecificNameSearch = false) {
    if (App.api?.isRpcBackoffActive?.("app_get_player_salary_quote")) return 0;
    return isSpecificNameSearch ? 8 : 2;
  },

  hasMarketSearchSalaryReference(player = {}) {
    const weeklySalary = Number(
      player.weeklySalary ||
        player.salaryWeekly ||
        player.SalarioSemanal ||
        player.weekly_salary_eur ||
        0,
    );
    const salarySourceName = String(
      player.salarySourceName ||
        player.FonteSalario ||
        player.salary_source_name ||
        "",
    ).trim();

    return weeklySalary > 0 && Boolean(salarySourceName);
  },

  async hydrateMarketSearchRowsWithSalary(
    rows = [],
    isSpecificNameSearch = false,
  ) {
    const players = Array.isArray(rows) ? rows : [];
    if (!players.length || typeof App.api?.getPlayerSalaryQuote !== "function") {
      return players;
    }

    let remainingLookups = Math.max(
      0,
      Number(App.transfers.getMarketSalaryLookupLimit(isSpecificNameSearch)),
    );

    return await Promise.all(
      players.map(async (player) => {
        if (!player || App.transfers.hasMarketSearchSalaryReference(player)) {
          return player;
        }
        if (remainingLookups <= 0) return player;
        remainingLookups -= 1;

        try {
          const marketValue = App.transfers.getMarketPlayerValue(player);
          const overall = App.transfers.getResolvedOverall({
            ...player,
            marketValue,
          });
          const quote = await App.api.getPlayerSalaryQuote({
            ...player,
            marketValue,
            overall,
          });
          if (!quote?.ok || Number(quote.weeklySalary || 0) <= 0) {
            return player;
          }
          return {
            ...player,
            weeklySalary: Number(quote.weeklySalary || 0),
            salarySourceName: quote.salarySourceName || "",
            salarySourceUrl: quote.salarySourceUrl || "",
            salaryReferenceType: quote.referenceType || "",
            referenceType: quote.referenceType || player.referenceType || "",
            salaryCheckedAt: quote.salaryCheckedAt || player.salaryCheckedAt || "",
            eligibilityMode: quote.eligibilityMode || player.eligibilityMode || "",
            salaryEligibilityMode:
              quote.eligibilityMode || player.salaryEligibilityMode || "",
          };
        } catch (error) {
          console.warn("Cotacao salarial indisponivel:", error);
          return player;
        }
      }),
    );
  },

  async hydrateMarketSearchRowsWithTransfermarkt(
    rows = [],
    isSpecificNameSearch = false,
  ) {
    const marketRows =
      await App.transfers.hydrateMissingTransfermarktMarketPlayers(rows, {
        maxLookups: App.transfers.getMarketTransfermarktLookupLimit(
          isSpecificNameSearch,
        ),
      });
    return await App.transfers.hydrateMarketSearchRowsWithSalary(
      marketRows,
      isSpecificNameSearch,
    );
  },

  renderMarketPlayerName(name = "", query = "") {
    const rawName = String(name || "-");
    const terms = [
      String(query || "").trim(),
      ...String(query || "")
        .split(/\s+/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 3),
    ]
      .filter(Boolean)
      .sort((left, right) => right.length - left.length);
    const lowerName = rawName.toLowerCase();
    const match = terms.find((term) =>
      lowerName.includes(term.toLowerCase()),
    );
    if (!match) return App.utils.escapeHtml(rawName);

    const index = lowerName.indexOf(match.toLowerCase());
    const end = index + match.length;
    return [
      App.utils.escapeHtml(rawName.slice(0, index)),
      `<mark class="market-player-match">${App.utils.escapeHtml(rawName.slice(index, end))}</mark>`,
      App.utils.escapeHtml(rawName.slice(end)),
    ].join("");
  },

  getTransfermarktPlayerId(value) {
    return (
      String(value || "").match(/\/spieler\/(\d+)/)?.[1] ||
      String(value || "").match(/^(\d+)$/)?.[1] ||
      ""
    );
  },

  hasMarketAvatarCache() {
    return Boolean(App.data?.marketPlayerAvatars);
  },

  ensureMarketAvatarCacheLoaded() {
    if (App.transfers.hasMarketAvatarCache()) return Promise.resolve(true);
    if (App.transfers.marketAvatarCachePromise) {
      return App.transfers.marketAvatarCachePromise;
    }

    App.transfers.marketAvatarCachePromise = new Promise((resolve) => {
      const script = document.createElement("script");
      const version = App.config?.assetVersion || Date.now();
      script.src = `./js/market-avatars.js?v=${encodeURIComponent(version)}`;
      script.type = "module";
      script.defer = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        console.warn("Cache local de fotos do mercado indisponível.");
        resolve(false);
      };
      document.head.appendChild(script);
    });

    return App.transfers.marketAvatarCachePromise;
  },

  getTransferRate(overall) {
    if (overall >= 89) return 0.25;
    if (overall >= 84) return 0.15;
    if (overall >= 80) return 0.1;
    if (overall >= 75) return 0.05;
    return 0;
  },

  getExternalSellerExpectationRate(overall) {
    if (overall >= 88) return 0.24;
    if (overall >= 84) return 0.2;
    if (overall >= 80) return 0.15;
    if (overall >= 76) return 0.1;
    if (overall >= 72) return 0.06;
    return 0.03;
  },

  roundTransferOfferValue(value) {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    return Math.max(100000, Math.round(amount / 100000) * 100000);
  },

  parseTransferMoneyInput(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }

    const digits = String(value || "").replace(/[^\d]/g, "");
    return digits ? Number(digits) : 0;
  },

  formatTransferMoneyInput(value) {
    const amount = Math.round(App.transfers.parseTransferMoneyInput(value));
    if (!amount) return "";
    return amount.toLocaleString("pt-BR");
  },

  formatWeeklySalaryInputValue(value) {
    const amount = Math.round(App.transfers.parseTransferMoneyInput(value));
    if (!amount) return "";
    return `${App.utils.formatCurrency(amount)} /sem`;
  },

  setTransferOfferInputValue(fieldOrForm, value) {
    const field = fieldOrForm?.elements?.offerValue || fieldOrForm;
    if (!field) return;

    const rounded = App.transfers.roundTransferOfferValue(
      App.transfers.parseTransferMoneyInput(value),
    );
    field.value = rounded ? App.transfers.formatTransferMoneyInput(rounded) : "";
    field.dataset.rawValue = rounded ? String(rounded) : "";
  },

  getWeeklySalaryInputValue(fieldOrForm) {
    const field = fieldOrForm?.elements?.weeklySalary || fieldOrForm;
    return App.transfers.parseTransferMoneyInput(field?.value || "");
  },

  setWeeklySalaryInputValue(fieldOrForm, value) {
    const field = fieldOrForm?.elements?.weeklySalary || fieldOrForm;
    if (!field) return;

    const amount = Math.round(App.transfers.parseTransferMoneyInput(value));
    field.value = amount ? App.transfers.formatWeeklySalaryInputValue(amount) : "";
  },

  getExternalOfferVerdict(preview = {}) {
    if (!preview || preview.isInternal || !preview.hasEnoughData) return null;

    const offer = Number(preview.finalValue || 0);
    const expected = Number(preview.sellerExpectationValue || 0);
    const reference = Number(preview.marketValue || 0);
    if (offer <= 0 || expected <= 0 || reference <= 0) return null;

    const acceptanceRatio = offer / expected;
    const referenceRatio = offer / reference;
    const acceptanceProbability = Math.max(
      4,
      Math.min(
        98,
        Math.round(
          (acceptanceRatio >= 1 ? 72 + (acceptanceRatio - 1) * 220 : 24 + acceptanceRatio * 50)
          + Math.max(0, (referenceRatio - 1) * 90),
        ),
      ),
    );

    if (offer >= expected * 1.12) {
      return {
        tone: "success",
        label: "Alta chance de aceite",
        detail:
          "Oferta acima do esperado para esse perfil. O clube vendedor tende a aceitar ou pedir ajustes pequenos.",
        acceptanceProbability,
        acceptanceDelta: acceptanceRatio - 1,
        deltaTag: "Muito acima",
      };
    }

    if (offer >= expected) {
      return {
        tone: "success",
        label: "Aceite provável",
        detail:
          "Dentro do patamar esperado; boa chance de aceitação com validação do clube.",
        acceptanceProbability,
        acceptanceDelta: acceptanceRatio - 1,
        deltaTag: "No alvo",
      };
    }

    if (offer >= expected * 0.9) {
      return {
        tone: "warning",
        label: "Aceite parcial provável",
        detail:
          "Pode precisar de ajuste menor ou prazo para reavaliação do clube vendedor.",
        acceptanceProbability,
        acceptanceDelta: acceptanceRatio - 1,
        deltaTag: "Abaixo do esperado",
      };
    }

    if (offer < expected * 0.78) {
      return {
        tone: "danger",
        label: "Risco alto",
        detail:
          "Oferta abaixo do esperado; tendência de contraoferta ou recusa.",
        acceptanceProbability,
        acceptanceDelta: acceptanceRatio - 1,
        deltaTag: "Muito abaixo",
      };
    }

    return {
      tone: "warning",
      label: "Contraoferta provável",
      detail:
        "Proposta abaixo de mercado pode gerar contraoferta com nova rodada.",
      acceptanceProbability,
      acceptanceDelta: acceptanceRatio - 1,
      deltaTag: "Zona de negociação",
    };
  },

  findEaRatingByName(playerName) {
    const key = App.transfers.normalizePlayerRatingKey(playerName);
    if (!key) return null;
    return (
      App.transfers.sortRatingCandidates(
        (App.state.apiRatings || []).filter(
          (item) => App.transfers.normalizePlayerRatingKey(item.name) === key,
        ),
        key,
      )[0] || null
    );
  },

  findMarketPlayerByName(playerName, context = {}) {
    const aliasKeys = App.transfers
      .getPlayerSearchAliases(playerName)
      .map(App.transfers.normalizePlayerRatingKey);
    const clubKey = App.utils.normalizeText(
      context?.club || context?.fromClub || context?.clubName || "",
    );
    const marketPlayers = Array.isArray(App.state.apiMarketPlayers)
      ? App.state.apiMarketPlayers
      : [];
    if (!aliasKeys.length || !marketPlayers.length) return null;

    const exactMatches = marketPlayers.filter((item) =>
      aliasKeys.includes(App.transfers.normalizePlayerRatingKey(item.name)),
    );
    const fuzzyMatches = marketPlayers.filter((item) => {
      const marketKey = App.transfers.normalizePlayerRatingKey(item.name);
      return aliasKeys.some((aliasKey) =>
        App.transfers.isTrustedPlayerNameMatch(aliasKey, marketKey),
      );
    });
    const byIdentity = [...exactMatches, ...fuzzyMatches].reduce(
      (acc, item) => {
        const key = String(
          item.id || item.transfermarkt_url || item.name || "",
        );
        if (key && !acc[key]) acc[key] = item;
        return acc;
      },
      {},
    );
    const matches = Object.values(byIdentity);

    return (
      (clubKey
        ? matches.find(
            (item) => App.utils.normalizeText(item.club || "") === clubKey,
          )
        : null) ||
      matches[0] ||
      null
    );
  },

  findEaRatingForMarketPlayer(player) {
    const key = App.transfers.normalizePlayerRatingKey(player?.name);
    if (!key) return null;

    const clubKey = App.utils.normalizeText(player?.club);
    const ratings = (App.state.apiRatings || []).filter(
      App.transfers.isPlayableRating,
    );
    const aliasKeys = App.transfers
      .getPlayerSearchAliases(player?.name)
      .map(App.transfers.normalizePlayerRatingKey);
    const matches = ratings.filter((item) => {
      const ratingKey = App.transfers.normalizePlayerRatingKey(item.name);
      return aliasKeys.some((aliasKey) =>
        App.transfers.isTrustedPlayerNameMatch(aliasKey, ratingKey),
      );
    });
    const selected =
      App.transfers.sortRatingCandidates(matches, key, clubKey)[0] || null;

    return App.transfers.applyManualRatingFallback(selected, player?.name);
  },

  getRatingSourceMeta(item = {}) {
    const sourceName = App.utils.normalizeText(item.source_name || "");
    const sourceUrl = App.utils.normalizeText(item.source_url || "");

    if (sourceUrl.includes("ea.com")) {
      return {
        priority: 60,
        label: "EA FC oficial",
      };
    }
    if (sourceName.includes("futbin") || sourceUrl.includes("futbin.com")) {
      return {
        priority: 50,
        label: "FUTBIN",
      };
    }
    if (
      sourceName.includes("official") &&
      sourceUrl.includes("sofifa.com")
    ) {
      return {
        priority: 45,
        label: "EA FC + SoFIFA",
      };
    }
    if (
      (sourceName.includes("ea sports") || sourceName.includes("official")) &&
      !sourceUrl.includes("fifaratings.com")
    ) {
      return {
        priority: 40,
        label: "EA FC",
      };
    }
    if (sourceName.includes("sofifa") || sourceUrl.includes("sofifa.com")) {
      return {
        priority: 35,
        label: "SoFIFA",
      };
    }
    if (
      sourceName.includes("fifa ratings") ||
      sourceUrl.includes("fifaratings.com")
    ) {
      return {
        priority: 20,
        label: "FIFA Ratings",
      };
    }
    return {
      priority: 10,
      label: item.source_name || "Rating",
    };
  },

  getRatingSourcePriority(item = {}) {
    if (App.api?.getRatingSourcePriority) {
      return App.api.getRatingSourcePriority(item);
    }
    return App.transfers.getRatingSourceMeta(item).priority;
  },

  getRatingSourceLabel(item = {}) {
    return App.transfers.getRatingSourceMeta(item).label;
  },

  sortRatingCandidates(candidates = [], nameKey = "", clubKey = "") {
    return [...candidates].sort((a, b) => {
      const aNameExact =
        App.transfers.normalizePlayerRatingKey(a.name) === nameKey ? 1 : 0;
      const bNameExact =
        App.transfers.normalizePlayerRatingKey(b.name) === nameKey ? 1 : 0;
      const aClubMatch =
        !clubKey || !a.club || App.utils.normalizeText(a.club) === clubKey
          ? 1
          : 0;
      const bClubMatch =
        !clubKey || !b.club || App.utils.normalizeText(b.club) === clubKey
          ? 1
          : 0;
      return (
        bNameExact - aNameExact ||
        bClubMatch - aClubMatch ||
        App.transfers.getRatingSourcePriority(b) -
          App.transfers.getRatingSourcePriority(a) ||
        (App.transfers.isUsablePlayerAvatar(b.avatar_url) ? 1 : 0) -
          (App.transfers.isUsablePlayerAvatar(a.avatar_url) ? 1 : 0) ||
        Number(b.overall || 0) - Number(a.overall || 0) ||
        String(a.name || "").localeCompare(String(b.name || ""))
      );
    });
  },

  getPlayerAvatarCandidates(player, rating = null) {
    const manualAvatar = App.transfers.getManualPlayerAvatarOverride(
      player?.name || rating?.name,
      {
        club: player?.club || rating?.club || "",
      },
    );
    const manual = App.transfers.getManualPlayerRating(
      player?.name || rating?.name,
    );
    const candidates = [
      manualAvatar?.avatar_url,
      rating?.avatar_url,
      manual?.avatar_url,
      player?.avatar_url,
      App.transfers.getMarketPlayerAvatar(player),
    ]
      .filter(App.transfers.isUsablePlayerAvatar)
      .map((url) => String(url).trim())
      .filter((url) => !App.transfers.isAvatarUnavailable(url));

    return [...new Set(candidates)];
  },

  isAvatarUnavailable(url = "") {
    return App.transfers.failedAvatarUrls.has(String(url || "").trim());
  },

  getPlayerAvatarSourceClass(url = "") {
    const normalized = App.utils.normalizeText(url);
    if (normalized.includes("sofifa") || normalized.includes("cdn.sofifa")) {
      return "avatar-source-sofifa";
    }
    if (normalized.includes("fifaratings")) return "avatar-source-fifaratings";
    if (normalized.includes("transfermarkt"))
      return "avatar-source-transfermarkt";
    if (normalized.includes("futbin")) return "avatar-source-futbin";
    return "avatar-source-generic";
  },

  syncPlayerPhotoSourceClass(container, url = "") {
    if (!container) return;
    container.classList.remove(
      "avatar-source-sofifa",
      "avatar-source-fifaratings",
      "avatar-source-transfermarkt",
      "avatar-source-futbin",
      "avatar-source-generic",
    );
    if (url)
      container.classList.add(App.transfers.getPlayerAvatarSourceClass(url));
  },

  handlePlayerPhotoError(image) {
    const failedUrl = String(image?.currentSrc || image?.src || "").trim();
    if (failedUrl) App.transfers.failedAvatarUrls.add(failedUrl);

    const candidates = (() => {
      try {
        return JSON.parse(
          decodeURIComponent(image.dataset.avatarCandidates || "[]"),
        );
      } catch (_) {
        return [];
      }
    })();
    const nextIndex = Number(image.dataset.avatarIndex || 0) + 1;
    const nextAvatar = candidates
      .slice(nextIndex)
      .find((candidate) => !App.transfers.isAvatarUnavailable(candidate));

    if (nextAvatar) {
      image.dataset.avatarIndex = String(candidates.indexOf(nextAvatar));
      image.src = nextAvatar;
      image.parentElement?.classList.remove("avatar-loaded", "avatar-failed");
      image.parentElement?.classList.add("has-player-image");
      App.transfers.syncPlayerPhotoSourceClass(image.parentElement, nextAvatar);
      return;
    }

    image.parentElement?.classList.remove("avatar-loaded", "has-player-image");
    image.parentElement?.classList.add("avatar-failed");
    image.remove();
  },

  handlePlayerPhotoLoad(image) {
    image?.parentElement?.classList.remove("avatar-failed");
    image?.parentElement?.classList.add("avatar-loaded");
  },

  syncPlayerPhotoLoadStates(root = document) {
    const scope = root?.querySelectorAll ? root : document;
    scope
      .querySelectorAll(".player-photo-shell.has-player-image img")
      .forEach((image) => {
        image.onload = () => App.transfers.handlePlayerPhotoLoad(image);
        image.onerror = () => App.transfers.handlePlayerPhotoError(image);

        if (!image.complete) return;
        if (image.naturalWidth > 0) {
          App.transfers.handlePlayerPhotoLoad(image);
        } else {
          App.transfers.handlePlayerPhotoError(image);
        }
      });
  },

  renderPlayerPhoto(player, rating = null, className = "market-player-photo") {
    const avatarCandidates = App.transfers.getPlayerAvatarCandidates(
      player,
      rating,
    );
    const avatar = avatarCandidates[0] || "";
    const name = player?.name || rating?.name || "?";
    const fallback = App.utils.escapeHtml(String(name).charAt(0));
    const encodedCandidates = encodeURIComponent(
      JSON.stringify(avatarCandidates),
    );
    const sourceClass = avatar
      ? App.transfers.getPlayerAvatarSourceClass(avatar)
      : "";

    return `
      <span class="${className} player-photo-shell ${sourceClass} ${avatar ? "has-player-image" : ""}">
        ${avatar ? `<img src="${App.utils.escapeHtml(avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-avatar-candidates="${encodedCandidates}" data-avatar-index="0" onload="App.transfers.handlePlayerPhotoLoad(this)" onerror="App.transfers.handlePlayerPhotoError(this)" />` : ""}
        <i>${fallback}</i>
      </span>
    `;
  },

  getMarketPlayerAvatar(player) {
    const transfermarktId =
      App.transfers.getTransfermarktPlayerId(
        player?.transfermarkt_id || player?.transfermarktId || "",
      ) ||
      App.transfers.getTransfermarktPlayerId(
        player?.transfermarkt_url || player?.transfermarktUrl || "",
      ) ||
      "";
    if (!transfermarktId) return "";

    const avatar = App.data?.marketPlayerAvatars?.[transfermarktId] || "";
    return App.transfers.isUsablePlayerAvatar(avatar) ? avatar : "";
  },

  needsMarketAvatarCacheForTransfers(transfers = []) {
    if (App.transfers.hasMarketAvatarCache()) return false;

    return (transfers || []).some((item) => {
      const marketPlayer = App.transfers.findMarketPlayerByName(item?.player, {
        club: item?.fromClub,
      });
      if (!marketPlayer) return false;
      if (App.transfers.isUsablePlayerAvatar(marketPlayer.avatar_url))
        return false;
      return Boolean(
        App.transfers.getTransfermarktPlayerId(
          marketPlayer.transfermarkt_url || marketPlayer.transfermarktUrl,
        ),
      );
    });
  },

  getRatingForPlayerName(playerName, context = {}) {
    const marketPlayer = App.transfers.findMarketPlayerByName(
      playerName,
      context,
    );
    const marketAvatar = App.transfers.getMarketPlayerAvatar(marketPlayer);
    const manualAvatar = App.transfers.getManualPlayerAvatarOverride(
      playerName,
      context,
    );
    const rating = App.transfers.findEaRatingForMarketPlayer(
      marketPlayer || { name: playerName, club: context?.club || "" },
    );
    const ratingWithManualAvatar =
      rating && manualAvatar
        ? {
            ...rating,
            avatar_url: manualAvatar.avatar_url,
            source_url: manualAvatar.source_url || rating.source_url,
            source_name: manualAvatar.source_name || rating.source_name,
          }
        : rating;

    return (
      ratingWithManualAvatar ||
      (manualAvatar
        ? {
            name: manualAvatar.name,
            club: manualAvatar.club,
            avatar_url: manualAvatar.avatar_url,
            source_url: manualAvatar.source_url,
            source_name: manualAvatar.source_name,
          }
        : null) ||
      (marketPlayer?.avatar_url || marketAvatar
        ? {
            name: marketPlayer.name,
            club: marketPlayer.club,
            position: marketPlayer.position,
            avatar_url: marketPlayer.avatar_url || marketAvatar,
          }
        : null)
    );
  },

  renderPlayerIdentity(
    playerName,
    detail = "",
    className = "player-identity",
    context = {},
  ) {
    const marketPlayer = App.transfers.findMarketPlayerByName(
      playerName,
      context,
    );
    const rating = App.transfers.getRatingForPlayerName(playerName, context);
    return `
      <span class="${className}">
        ${App.transfers.renderPlayerPhoto(marketPlayer || { name: playerName }, rating, "player-avatar")}
        <span class="player-identity-copy">
          <strong>${App.utils.escapeHtml(playerName || "-")}</strong>
          ${detail ? `<small>${App.utils.escapeHtml(detail)}</small>` : ""}
        </span>
      </span>
    `;
  },

  getAllTransfers() {
    const approvedApiTransfers = App.state.apiTransfers
      .filter((row) =>
        App.transfers.isApprovedTransferStatus(row.Status || row.status),
      )
      .map((row, index) => {
        const transferType = row.TipoTransferencia || row.transfer_type || "";
        const isCpuSale = App.utils.normalizeText(transferType) === "cpu_sale";
        const destinationClub =
          row.ClubeDestino || row.Destino || row.destination_club || "";
        const negotiatedValue = Number(
          row.ValorNegociado ??
            row.negotiated_value ??
            row.ValorFinal ??
            row.final_value ??
            0,
        );
        const grossFinalValue = Number(row.ValorFinal ?? row.final_value ?? 0);
        const tradeInCredit =
          !isCpuSale && negotiatedValue > 0
            ? Math.max(0, grossFinalValue - negotiatedValue)
            : 0;

        return {
          id: row.Id || row.id || "",
          player: row.Jogador,
          buyer: isCpuSale
            ? destinationClub || row.Comprador || "Clube interessado"
            : row.Comprador,
          seller:
            row.Vendedor || (isCpuSale ? row.CompradorRegistro || "" : ""),
          originalBuyer: row.CompradorRegistro || row.Comprador || "",
          destinationClub,
          fromClub:
            row.ClubeOrigem ||
            (isCpuSale
              ? `Venda para ${destinationClub || "clube interessado"}`
              : row.ClubeOrigem),
          overall: Number(row.Overall),
          marketValue: Number(
            isCpuSale ? negotiatedValue : row.ValorTransfermarkt,
          ),
          negotiatedValue,
          grossFinalValue,
          tradeInCredit,
          cashValue: !isCpuSale && negotiatedValue > 0 ? negotiatedValue : 0,
          weeklySalary: Number(
            row.SalarioSemanal ?? row.weeklySalary ?? row.salaryWeekly ?? 0,
          ),
          salarySourceName: row.FonteSalario || row.salarySourceName || "",
          salarySourceUrl: row.UrlFonteSalario || row.salarySourceUrl || "",
          salaryReferenceType:
            row.TipoReferenciaSalario ||
            row.salaryReferenceType ||
            row.salary_reference_type ||
            "",
          saleValue: isCpuSale ? negotiatedValue : 0,
          status: row.Status || row.status || "",
          reason: row.Motivo || row.reason || "",
          timestamp: row.Timestamp,
          sourceIndex: index,
          transferType,
          isCpuSale,
        };
      });

    const staticTransfers = App.state.apiLoaded
      ? []
      : App.data.transfers.map((transfer, index) => ({
          ...transfer,
          timestamp: transfer.timestamp || "",
          sourceIndex: index,
        }));

    return [...staticTransfers, ...approvedApiTransfers];
  },

  isApprovedTransferStatus(status) {
    return ["aprovado", "approved"].includes(App.utils.normalizeText(status));
  },

  isRejectedTransferStatus(status) {
    return ["recusado", "rejeitado", "rejected"].includes(
      App.utils.normalizeText(status),
    );
  },

  isCpuSaleTransfer(item = {}) {
    const transferType = App.utils.normalizeText(
      item.transferType || item.TipoTransferencia || item.transfer_type || "",
    );
    const reason = App.utils.normalizeText(item.reason || item.Motivo || "");
    const fromClub = App.utils.normalizeText(
      item.fromClub || item.ClubeOrigem || "",
    );
    return (
      item.isCpuSale === true ||
      transferType === "cpu_sale" ||
      reason === "venda para cpu" ||
      fromClub === "venda para cpu"
    );
  },

  getCpuSaleDestination(item = {}) {
    const destination =
      item.destinationClub ||
      item.ClubeDestino ||
      item.Destino ||
      item.destination_club ||
      item.buyer ||
      "";
    return App.utils.normalizeText(destination) === "cpu" ||
      !String(destination).trim()
      ? "clube interessado"
      : destination;
  },

  getMovementValue(item = {}) {
    if (App.transfers.isCpuSaleTransfer(item)) {
      return Number(
        item.saleValue ||
          item.negotiatedValue ||
          item.ValorNegociado ||
          item.totalCost ||
          item.marketValue ||
          item.ValorFinal ||
          0,
      );
    }
    return Number(
      item.marketValue || item.ValorTransfermarkt || item.totalCost || 0,
    );
  },

  isCompletedMovementTransfer(item = {}) {
    if (App.transfers.isRejectedTransferStatus(item.status || item.Status)) {
      return false;
    }
    if (!App.transfers.isCpuSaleTransfer(item)) return true;
    return App.transfers.getMovementValue(item) > 0;
  },

  isMarketPlayerContracted(player) {
    const playerKey = App.transfers.normalizePlayerRatingKey(player?.name);
    if (!playerKey) return false;
    if (App.api?.getLatestMovementByPlayer) {
      const latestMovements = App.api.getLatestMovementByPlayer();
      const clubKey = App.transfers.normalizePlayerRatingKey(
        player?.club || player?.original_club || player?.fromClub || player?.originalClub || "",
      );
      const contractMovement =
        (clubKey
          ? latestMovements[`${playerKey}|${clubKey}`]
          : null) ||
        latestMovements[playerKey];

      if (contractMovement?.buyer) {
        return App.utils
          .getHumanBuyers()
          .some(
            (owner) =>
              App.utils.normalizeText(owner) ===
              App.utils.normalizeText(contractMovement.buyer),
          );
      }
    }

    const latest = App.transfers
      .getAllTransfers()
      .filter((transfer) => {
        const transferPlayerKey = App.transfers.normalizePlayerRatingKey(
          transfer.player,
        );
        if (transferPlayerKey !== playerKey) return false;
        const transferClub = App.transfers.normalizePlayerRatingKey(
          transfer.fromClub || transfer.club || "",
        );
        const playerClub = App.transfers.normalizePlayerRatingKey(
          player?.club || player?.fromClub || player?.original_club || "",
        );

        if (!playerClub || !transferClub) return true;
        return transferClub === playerClub;
      })
      .sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return (
          (Number.isNaN(timeB) ? 0 : timeB) - (Number.isNaN(timeA) ? 0 : timeA)
        );
      })[0];

    if (!latest || App.utils.normalizeText(latest.buyer) === "cpu")
      return false;
    return App.utils
      .getHumanBuyers()
      .some(
        (owner) =>
          App.utils.normalizeText(owner) ===
          App.utils.normalizeText(latest.buyer),
      );
  },

  getEventImpactByBuyer() {
    const impact = App.utils.getHumanBuyers().reduce((acc, buyer) => {
      acc[buyer] = {
        positive: 0,
        negative: 0,
        total: 0,
        events: 0,
        transferModifier: 0,
        activeInjuries: 0,
      };
      return acc;
    }, {});

    const todayText = new Date().toLocaleDateString("pt-BR");

    App.state.apiEvents
      .filter((event) =>
        ["aplicado", "ativo", "gerado"].includes(
          App.utils.normalizeText(event.Status),
        ),
      )
      .forEach((event) => {
        const owner = event.Jogador;
        if (!impact[owner]) return;

        const value = Number(event.ImpactoFinanceiro || 0);
        const transferModifier = Number(event.ModificadorTransferencias || 0);
        const eventTimestamp = new Date(event.Timestamp || 0);
        const isTodayEvent =
          String(event.Data || "") === todayText ||
          (!Number.isNaN(eventTimestamp.getTime()) &&
            eventTimestamp.toLocaleDateString("pt-BR") === todayText);

        impact[owner].events += 1;
        impact[owner].total += value;
        if (isTodayEvent)
          impact[owner].transferModifier += Number.isNaN(transferModifier)
            ? 0
            : transferModifier;
        if (value >= 0) impact[owner].positive += value;
        else impact[owner].negative += value;

        const durationType = App.utils.normalizeText(event.DuracaoTipo || "");
        const affectedPlayer = String(event.JogadorAfetado || "").trim();
        const remainingMatches = Number(
          event.PartidasRestantes || event.DuracaoValor || 0,
        );
        const expiresAt = event.ExpiraEm ? new Date(event.ExpiraEm) : null;
        const stillTimeActive =
          expiresAt &&
          !Number.isNaN(expiresAt.getTime()) &&
          expiresAt > new Date();
        const stillMatchActive =
          durationType.includes("partida") && remainingMatches > 0;

        if (affectedPlayer && (stillTimeActive || stillMatchActive))
          impact[owner].activeInjuries += 1;
      });

    return impact;
  },

  getOnboardingLimitForBuyer(buyer) {
    const onboarding = App.state.apiOnboarding?.[buyer];
    if (
      !onboarding ||
      onboarding.transferLimit === undefined ||
      onboarding.transferLimit === null
    )
      return null;
    const limit = Number(onboarding.transferLimit);
    return Number.isFinite(limit) && limit > 0 ? limit : null;
  },

  getTransferLimitForBuyer(buyer) {
    const onboardingLimit = App.transfers.getOnboardingLimitForBuyer(buyer);
    if (onboardingLimit !== null) return onboardingLimit;

    const supabaseBudget = App.state.apiBudgets?.[buyer];
    if (supabaseBudget?.transferLimit !== undefined)
      return Number(supabaseBudget.transferLimit);

    const impact = App.transfers.getEventImpactByBuyer();
    const modifier = impact[buyer]?.transferModifier || 0;
    return Math.max(
      0,
      Math.min(5, App.config.baseDailyTransferLimit + modifier),
    );
  },

  getBudgetInfoByBuyer() {
    const buyers = App.utils.getHumanBuyers();
    const info = buyers.reduce((acc, buyer) => {
      const supabaseBudget = App.state.apiBudgets?.[buyer] || {};
      const totalBudget = Number(
        supabaseBudget.totalBudget ?? App.config.transferBudget,
      );
      const spentTotal = Number(supabaseBudget.spentTotal ?? 0);
      const pendingSignatureTotal = Number(
        supabaseBudget.pendingSignatureTotal ??
          supabaseBudget.reservedBudget ??
          0,
      );
      const approvedRemainingBudget = Number(
        supabaseBudget.approvedRemainingBudget ?? totalBudget - spentTotal,
      );
      const availableBudget = Number(
        supabaseBudget.availableBudget ??
          supabaseBudget.remainingBudget ??
          approvedRemainingBudget - pendingSignatureTotal,
      );

      acc[buyer] = {
        buyer,
        baseBudget: Number(
          supabaseBudget.baseBudget ?? App.config.transferBudget,
        ),
        homeMatches: Number(supabaseBudget.homeMatches ?? 0),
        wins: Number(supabaseBudget.wins ?? 0),
        homeBonus: Number(supabaseBudget.homeBonus ?? 0),
        winBonusValue: Number(
          supabaseBudget.winBonusValue ?? supabaseBudget.winBonus ?? 0,
        ),
        eventBonus: Number(supabaseBudget.eventBonus ?? 0),
        eventPenalty: 0,
        eventTotal: Number(supabaseBudget.eventTotal ?? 0),
        eventCount: Number(supabaseBudget.eventCount ?? 0),
        sponsorshipRewards: Number(supabaseBudget.sponsorshipRewards ?? 0),
        transferModifier: Number(supabaseBudget.transferModifier ?? 0),
        transferLimit: Number(
          supabaseBudget.transferLimit ?? App.config.baseDailyTransferLimit,
        ),
        activeInjuries: Number(supabaseBudget.activeInjuries ?? 0),
        totalBudget,
        spentTotal,
        approvedRemainingBudget,
        pendingSignatureTotal,
        reservedBudget: pendingSignatureTotal,
        availableBudget,
        remainingBudget: availableBudget,
        transfersToday: Number(supabaseBudget.transfersToday ?? 0),
      };
      return acc;
    }, {});

    if (Object.keys(App.state.apiBudgets || {}).length) {
      return info;
    }

    App.standings
      .getApprovedApiResults()
      .filter(
        (result) =>
          App.utils.normalizeText(result.Competicao) === "championship",
      )
      .forEach((result) => {
        const homeTeam = App.utils.getTeamByName(result.Mandante);
        const awayTeam = App.utils.getTeamByName(result.Visitante);
        const homeScore = Number(result.GolsMandante);
        const awayScore = Number(result.GolsVisitante);
        if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) return;

        if (homeTeam?.status === "Nosso" && info[homeTeam.owner])
          info[homeTeam.owner].homeMatches += 1;
        if (
          homeScore > awayScore &&
          homeTeam?.status === "Nosso" &&
          info[homeTeam.owner]
        )
          info[homeTeam.owner].wins += 1;
        if (
          awayScore > homeScore &&
          awayTeam?.status === "Nosso" &&
          info[awayTeam.owner]
        )
          info[awayTeam.owner].wins += 1;
      });

    const eventImpact = App.transfers.getEventImpactByBuyer();

    Object.values(info).forEach((item) => {
      item.homeBonus = item.homeMatches * App.config.homeMatchBonus;
      item.winBonusValue = item.wins * App.config.winBonus;
      item.eventBonus = eventImpact[item.buyer]?.positive || 0;
      item.eventPenalty = eventImpact[item.buyer]?.negative || 0;
      item.eventTotal = eventImpact[item.buyer]?.total || 0;
      item.eventCount = eventImpact[item.buyer]?.events || 0;
      item.sponsorshipRewards = 0;
      item.transferModifier = eventImpact[item.buyer]?.transferModifier || 0;
      item.transferLimit = App.transfers.getTransferLimitForBuyer(item.buyer);
      item.activeInjuries = eventImpact[item.buyer]?.activeInjuries || 0;
      item.totalBudget =
        item.baseBudget + item.homeBonus + item.winBonusValue + item.eventTotal;
    });

    return info;
  },

  getTransfersWithStats() {
    const allTransfers = App.transfers.getAllTransfers();
    const ownershipTransfers = allTransfers
      .map((transfer, index) => ({ transfer, index }))
      .filter(({ transfer }) =>
        App.transfers.isCompletedMovementTransfer(transfer),
      );
    const nameCounts = ownershipTransfers.reduce((acc, { transfer }) => {
      const key = App.utils.normalizeText(transfer.player);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const latestIndexByPlayer = ownershipTransfers.reduce(
      (acc, { transfer, index }) => {
        const key = App.utils.normalizeText(transfer.player);
        const currentIndex = acc[key];
        if (currentIndex === undefined) {
          acc[key] = index;
          return acc;
        }

        const currentTime = new Date(
          allTransfers[currentIndex].timestamp || 0,
        ).getTime();
        const nextTime = new Date(transfer.timestamp || 0).getTime();
        const currentScore = Number.isNaN(currentTime) ? 0 : currentTime;
        const nextScore = Number.isNaN(nextTime) ? 0 : nextTime;
        if (
          nextScore > currentScore ||
          (nextScore === currentScore && index > currentIndex)
        )
          acc[key] = index;
        return acc;
      },
      {},
    );
    const spentByBuyer = {};

    return allTransfers.map((transfer, index) => {
      const isCpuSale = App.transfers.isCpuSaleTransfer(transfer);
      const baseValue = App.transfers.getMovementValue(transfer);
      const resolvedOverall = App.transfers.getTransferOverall(transfer);
      const salaryReference = App.transfers.getSalaryReferenceFromItem({
        ...transfer,
        overall: resolvedOverall,
        marketValue:
          transfer.marketValue ||
          transfer.market_value_eur ||
          transfer.ValorTransfermarkt ||
          baseValue ||
          0,
      });
      const feeRate = isCpuSale
        ? 0
        : App.transfers.getTransferRate(resolvedOverall);
      const totalCost =
        transfer.cashValue ||
        Math.max(
          0,
          Number(baseValue || 0) +
            Number(baseValue || 0) * feeRate -
            Number(transfer.tradeInCredit || 0),
        );
      const grossTotalCost =
        transfer.grossFinalValue ||
        Number(baseValue || 0) + Number(baseValue || 0) * feeRate;
      const nameKey = App.utils.normalizeText(transfer.player);
      const hasDuplicate = nameCounts[nameKey] > 1;
      const isBlockedDuplicate =
        hasDuplicate && latestIndexByPlayer[nameKey] !== index;
      const countedCost = isBlockedDuplicate || isCpuSale ? 0 : totalCost;
      spentByBuyer[transfer.buyer] =
        (spentByBuyer[transfer.buyer] || 0) + countedCost;
      const budgetInfo = App.transfers.getBudgetInfoByBuyer()[transfer.buyer];
      const currentBudget =
        budgetInfo?.totalBudget || App.config.transferBudget;
      const runningSpent = Object.keys(App.state.apiBudgets || {}).length
        ? budgetInfo?.spentTotal || 0
        : spentByBuyer[transfer.buyer];
      const remainingBudget = Object.keys(App.state.apiBudgets || {}).length
        ? (budgetInfo?.remainingBudget ?? currentBudget - runningSpent)
        : currentBudget - runningSpent;

      return {
        ...transfer,
        index,
        overall: resolvedOverall,
        weeklySalary: Number(salaryReference.weeklySalary || 0),
        salarySourceName: salaryReference.salarySourceName || "",
        salarySourceUrl: salaryReference.salarySourceUrl || "",
        salaryReferenceType: salaryReference.referenceType || "",
        feeRate,
        totalCost,
        grossTotalCost,
        isCpuSale,
        hasDuplicate,
        isBlockedDuplicate,
        currentBudget,
        runningSpent,
        remainingBudget,
      };
    });
  },

  getValidTransfers() {
    return App.transfers
      .getTransfersWithStats()
      .filter(
        (item) =>
          !item.isBlockedDuplicate &&
          App.transfers.isCompletedMovementTransfer(item),
      );
  },

  getTransferStatusClass(item) {
    if (App.transfers.isRejectedTransferStatus(item.status || item.Status)) {
      return "rejected";
    }
    if (item.isBlockedDuplicate) return "duplicate";
    if (App.transfers.isCpuSaleTransfer(item)) return "sale";
    if (item.runningSpent > item.currentBudget) return "overbudget";
    return "valid";
  },

  getTransferStatusLabel(item) {
    if (App.transfers.isRejectedTransferStatus(item.status || item.Status)) {
      return "Recusada";
    }
    if (item.isBlockedDuplicate) return "Duplicado";
    if (App.transfers.isCpuSaleTransfer(item)) return "Venda externa";
    if (item.runningSpent > item.currentBudget) return "Revisar";
    return "Válido";
  },

  getFilteredTransfers(limit = 5) {
    let data = App.transfers.getValidTransfers();
    const search = App.utils.normalizeText(
      document.getElementById("transferSearchInput")?.value,
    );
    const owner =
      document.getElementById("transferOwnerFilter")?.value || "all";
    const status =
      document.getElementById("transferStatusFilter")?.value || "all";

    if (owner !== "all")
      data = data.filter(
        (item) =>
          item.buyer === owner ||
          (App.transfers.isCpuSaleTransfer(item) && item.seller === owner),
      );
    if (status !== "all")
      data = data.filter(
        (item) => App.transfers.getTransferStatusClass(item) === status,
      );
    if (search) {
      data = data.filter(
        (item) =>
          App.utils.normalizeText(item.player).includes(search) ||
          App.utils.normalizeText(item.buyer).includes(search) ||
          App.utils.normalizeText(item.seller).includes(search) ||
          App.utils.normalizeText(item.fromClub).includes(search),
      );
    }

    data.sort((a, b) => {
      const aTime = new Date(a.timestamp || 0).getTime();
      const bTime = new Date(b.timestamp || 0).getTime();
      return (
        (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime) ||
        b.index - a.index
      );
    });

    return data.slice(0, limit);
  },

  getRecentTransferMovements(limit = 5) {
    return [...App.transfers.getValidTransfers()]
      .sort((a, b) => {
        const aTime = new Date(a.timestamp || 0).getTime();
        const bTime = new Date(b.timestamp || 0).getTime();
        return (
          (Number.isNaN(bTime) ? 0 : bTime) -
            (Number.isNaN(aTime) ? 0 : aTime) || b.index - a.index
        );
      })
      .slice(0, limit);
  },

  hydratePlayerPortraitsForTransfers(transfers = []) {
    const names = [
      ...new Set(
        (transfers || [])
          .map((item) => item?.player)
          .map((name) => String(name || "").trim())
          .filter(Boolean),
      ),
    ].slice(0, 40);

    if (!names.length || !App.api?.loadMarketPlayersForNames) return;

    const hydrationKey = [...names].sort().join("|");
    if (
      App.transfers.portraitHydrationKey === hydrationKey ||
      App.transfers.portraitHydrationRunning === hydrationKey
    )
      return;

    App.transfers.portraitHydrationRunning = hydrationKey;
    App.api
      .loadMarketPlayersForNames(names, 2)
      .then(() => App.api?.loadRatingsForPlayerNames?.(names, 2))
      .then(() =>
        App.transfers.needsMarketAvatarCacheForTransfers(transfers)
          ? App.transfers.ensureMarketAvatarCacheLoaded()
          : true,
      )
      .then(() => {
        App.transfers.portraitHydrationKey = hydrationKey;
        App.main?.renderCurrentView?.();
      })
      .catch((error) => {
        console.warn("Fotos de jogadores indisponiveis:", error);
      })
      .finally(() => {
        if (App.transfers.portraitHydrationRunning === hydrationKey) {
          App.transfers.portraitHydrationRunning = "";
        }
      });
  },

  getTransferOverall(item) {
    return App.transfers.getResolvedOverall({
      ...item,
      name: item?.player || item?.name || "",
      club: item?.fromClub || item?.club || "",
      marketValue:
        item?.marketValue ||
        item?.market_value_eur ||
        item?.ValorTransfermarkt ||
        item?.totalCost ||
        0,
    });
  },

  getImpactTransferSpotlights(limit = 3) {
    return [...App.transfers.getValidTransfers()]
      .map((item) => ({
        ...item,
        displayOverall: App.transfers.getTransferOverall(item),
      }))
      .filter((item) => Number(item.displayOverall || 0) > 88)
      .sort((a, b) => {
        const aTime = new Date(a.timestamp || 0).getTime();
        const bTime = new Date(b.timestamp || 0).getTime();
        return (
          (Number.isNaN(bTime) ? 0 : bTime) -
            (Number.isNaN(aTime) ? 0 : aTime) ||
          Number(b.displayOverall || 0) - Number(a.displayOverall || 0) ||
          Number(b.totalCost || 0) - Number(a.totalCost || 0)
        );
      })
      .slice(0, limit);
  },

  getTodayTransferCountByBuyer(buyer) {
    const supabaseBudget = App.state.apiBudgets?.[buyer];
    if (supabaseBudget?.transfersToday !== undefined)
      return Number(supabaseBudget.transfersToday);

    const today = new Date().toLocaleDateString("pt-BR");

    return App.state.apiTransfers
      .filter((row) => App.utils.normalizeText(row.Status) === "aprovado")
      .filter(
        (row) =>
          App.utils.normalizeText(
            row.TipoTransferencia || row.transfer_type,
          ) !== "cpu_sale",
      )
      .filter(
        (row) =>
          App.utils.normalizeText(row.Comprador) ===
          App.utils.normalizeText(buyer),
      )
      .filter((row) => {
        const timestamp = row.Timestamp;
        if (!timestamp) return false;

        if (typeof timestamp === "string" && timestamp.startsWith(today)) {
          return true;
        }

        const parsed = new Date(timestamp);
        if (Number.isNaN(parsed.getTime())) return false;
        return parsed.toLocaleDateString("pt-BR") === today;
      }).length;
  },

  getSpendingSummary() {
    const budgets = App.transfers.getBudgetInfoByBuyer();
    const validTransfers = App.transfers.getValidTransfers();
    const buyers = App.utils.getHumanBuyers();

    return buyers.map((buyer) => {
      const budget = budgets[buyer] || {};
      const transfers = validTransfers.filter((item) => item.buyer === buyer);
      const spent = Object.keys(App.state.apiBudgets || {}).length
        ? Number(budget.spentTotal || 0)
        : transfers.reduce((sum, item) => sum + item.totalCost, 0);
      const totalBudget = Number(
        budget.totalBudget || App.config.transferBudget,
      );
      const remaining = Object.keys(App.state.apiBudgets || {}).length
        ? Number(budget.remainingBudget ?? totalBudget - spent)
        : totalBudget - spent;
      const transferLimit = Number(
        budget.transferLimit ?? App.transfers.getTransferLimitForBuyer(buyer),
      );
      const transfersToday = Number(
        budget.transfersToday ??
          App.transfers.getTodayTransferCountByBuyer(buyer),
      );
      const pct =
        totalBudget > 0
          ? Math.min(100, Math.max(0, (spent / totalBudget) * 100))
          : 0;
      const payrollWeekly = transfers.reduce(
        (sum, item) => sum + App.transfers.getVerifiedWeeklySalary(item),
        0,
      );
      const payrollPressure =
        totalBudget > 0 ? (payrollWeekly * 4) / totalBudget : 0;
      const runwayWeeks =
        payrollWeekly > 0
          ? Math.floor(Math.max(0, remaining) / payrollWeekly)
          : null;
      const salaryDebtActive = Boolean(budget.salaryDebtActive);
      const salaryDebtAmount = Number(
        budget.salaryDebtAmount ?? (remaining < 0 ? Math.abs(remaining) : 0),
      );

      return {
        buyer,
        totalBudget,
        spent,
        remaining,
        transfers,
        count: transfers.length,
        transferLimit,
        transfersToday,
        pct,
        eventTotal: Number(budget.eventTotal || 0),
        activeInjuries: Number(budget.activeInjuries || 0),
        homeBonus: Number(budget.homeBonus || 0),
        winBonusValue: Number(budget.winBonusValue || 0),
        marketEmbargo: Boolean(
          budget.marketEmbargo || salaryDebtActive || remaining < 0,
        ),
        salaryDebtActive,
        salaryDebtAmount,
        salaryDebtWeeks: Number(budget.salaryDebtWeeks || 0),
        salaryDebtPayroll: Number(budget.salaryDebtPayroll || 0),
        salaryDebtPeriod: budget.salaryDebtPeriod || "",
        payrollWeekly,
        payrollPressure,
        runwayWeeks,
      };
    });
  },

  normalizeSalaryUrl(value = "") {
    return String(value || "").trim();
  },

  isPublicSalaryUrl(value = "") {
    return /^https?:\/\//i.test(App.transfers.normalizeSalaryUrl(value));
  },

  normalizeSalaryLookup(value = "") {
    return App.utils
      .normalizeText(value)
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  },

  getRegulatorySalaryModelUrl() {
    return "https://henriquetaffo.github.io/eafc26-championship/#salary-regulatory-model";
  },

  getSalaryReferenceLabel(reference = {}) {
    const type =
      reference.referenceType ||
      reference.salaryReferenceType ||
      reference.salary_reference_type ||
      "";
    const sourceName = App.utils.normalizeText(
      reference.salarySourceName || reference.sourceName || "",
    );
    const sourceUrl = App.transfers.normalizeSalaryUrl(
      reference.salarySourceUrl || reference.sourceUrl || "",
    );
    if (type === "regulatory_estimate") return "Estimativa regulatoria";
    if (type === "league_smart_estimate") return "Estimativa da liga";
    if (type === "loaded_salary") return "Salario carregado";
    if (type === "public_capology") return "Capology";
    if (type === "public_mlspa") return "MLSPA";
    if (type === "public_salarysport") return "SalarySport";
    if (sourceUrl.includes("capology.com") || sourceName.includes("capology")) {
      return "Capology";
    }
    if (
      sourceUrl.includes("salarysport.com") ||
      sourceName.includes("salarysport")
    ) {
      return "SalarySport";
    }
    if (
      sourceUrl.includes("mlsplayers.org") ||
      sourceName.includes("mls players association")
    ) {
      return "MLSPA";
    }
    return "Fonte salarial";
  },

  isRegulatorySalaryReference(item = {}) {
    const type = App.utils.normalizeText(
      item.referenceType ||
        item.salaryReferenceType ||
        item.salary_reference_type ||
        "",
    );
    const sourceName = App.utils.normalizeText(
      item.salarySourceName || item.sourceName || item.FonteSalario || "",
    );
    const sourceUrl = App.transfers.normalizeSalaryUrl(
      item.salarySourceUrl || item.sourceUrl || item.UrlFonteSalario || "",
    );

    return (
      type === "regulatory_estimate" ||
      sourceName.includes("estimativa regulatoria") ||
      sourceUrl === App.transfers.getRegulatorySalaryModelUrl()
    );
  },

  isEstimatedSalaryReference(item = {}) {
    const type = App.utils.normalizeText(
      item.referenceType ||
        item.salaryReferenceType ||
        item.salary_reference_type ||
        "",
    );
    const sourceName = App.utils.normalizeText(
      item.salarySourceName || item.sourceName || item.FonteSalario || "",
    );
    const sourceUrl = App.transfers.normalizeSalaryUrl(
      item.salarySourceUrl || item.sourceUrl || item.UrlFonteSalario || "",
    );

    return (
      type === "league_smart_estimate" ||
      App.transfers.isRegulatorySalaryReference(item) ||
      sourceName.includes("estimativa inteligente") ||
      sourceName.includes("estimativa da liga") ||
      sourceUrl.includes("#salary-smart-estimate")
    );
  },

  getRegulatoryOverallEstimate(item = {}) {
    const playerName =
      item.player || item.Jogador || item.name || item.playerName || "";
    const marketValue = Math.max(
      0,
      Number(
        item.marketValue ||
          item.market_value_eur ||
          item.ValorTransfermarkt ||
          0,
      ) || 0,
    );
    const age = Number(item.age || 0);
    const league = App.transfers.normalizeSalaryLookup(item.league || "");

    if (!String(playerName).trim() && marketValue <= 0) return null;

    let overall =
      marketValue >= 120000000
        ? 90
        : marketValue >= 80000000
          ? 88
          : marketValue >= 55000000
            ? 86
            : marketValue >= 35000000
              ? 84
              : marketValue >= 22000000
                ? 82
                : marketValue >= 14000000
                  ? 80
                  : marketValue >= 9000000
                    ? 78
                    : marketValue >= 6000000
                      ? 76
                      : marketValue >= 3500000
                        ? 74
                        : marketValue >= 2000000
                          ? 72
                          : marketValue >= 1000000
                            ? 70
                            : marketValue > 0
                              ? 68
                              : 0;

    if (
      [
        "premier league",
        "laliga",
        "serie a",
        "bundesliga",
        "ligue 1",
      ].includes(league)
    ) {
      overall += 1;
    } else if (
      [
        "championship",
        "super lig",
        "eredivisie",
        "liga portugal",
        "scottish premiership",
        "argentina primera division",
        "campeonato brasileiro serie a",
      ].includes(league)
    ) {
      overall -= 1;
    }

    if (age >= 18 && age <= 21 && marketValue >= 12000000) overall += 1;
    if (age >= 33) overall -= 1;
    if (age >= 35) overall -= 1;

    overall = Math.max(62, Math.min(91, Math.round(overall)));
    if (!overall) return null;

    return {
      ok: true,
      overall,
      sourceName: "Estimativa de OVR da liga",
      referenceType: "regulatory_estimate",
    };
  },

  getOverallReferenceFromItem(item = {}, options = {}) {
    const directOverall = Number(item.overall ?? item.Overall ?? 0);
    if (directOverall > 0) {
      return {
        ok: true,
        overall: directOverall,
        sourceName: item.overallSourceName || "Base importada",
        referenceType: item.overallSourceType || "imported",
      };
    }

    const rating = App.transfers.findEaRatingForMarketPlayer({
      name: item.player || item.Jogador || item.name || item.playerName || "",
      club: item.fromClub || item.ClubeOrigem || item.club || item.clubName || "",
    });
    if (Number(rating?.overall || 0) > 0) {
      return {
        ok: true,
        overall: Number(rating.overall || 0),
        sourceName: App.transfers.getRatingSourceLabel(rating),
        sourceUrl: rating.source_url || "",
        referenceType: "ea_rating",
      };
    }

    if (options.allowEstimate !== true) {
      return {
        ok: false,
        overall: 0,
        sourceName: "",
        sourceUrl: "",
        referenceType: "",
      };
    }

    return (
      App.transfers.getRegulatoryOverallEstimate(item) || {
        ok: false,
        overall: 0,
        sourceName: "",
        sourceUrl: "",
        referenceType: "",
      }
    );
  },

  getResolvedOverall(item = {}, options = {}) {
    return Number(
      App.transfers.getOverallReferenceFromItem(item, options).overall || 0,
    );
  },

  getRegulatoryMarketValueEstimate(item = {}) {
    const overall = Number(item.overall || item.Overall || 0);
    if (overall <= 0) return 0;

    const age = Number(item.age || 0);
    const league = App.transfers.normalizeSalaryLookup(item.league || "");
    let marketValue =
      overall >= 91
        ? 120000000
        : overall >= 90
          ? 100000000
          : overall >= 89
            ? 85000000
            : overall >= 88
              ? 70000000
              : overall >= 87
                ? 58000000
                : overall >= 86
                  ? 48000000
                  : overall >= 85
                    ? 38000000
                    : overall >= 84
                      ? 30000000
                      : overall >= 83
                        ? 24000000
                        : overall >= 82
                          ? 18000000
                          : overall >= 81
                            ? 14000000
                            : overall >= 80
                              ? 11000000
                              : overall >= 79
                                ? 8500000
                                : overall >= 78
                                  ? 6500000
                                  : overall >= 77
                                    ? 5000000
                                    : overall >= 76
                                      ? 4000000
                                      : overall >= 75
                                        ? 3200000
                                        : overall >= 74
                                          ? 2500000
                                          : overall >= 73
                                            ? 1800000
                                            : overall >= 72
                                              ? 1400000
                                              : overall >= 71
                                                ? 1100000
                                                : overall >= 70
                                                  ? 900000
                                                  : 600000;

    if (age > 0 && age <= 21) marketValue *= 1.4;
    else if (age <= 24) marketValue *= 1.18;
    else if (age >= 35) marketValue *= 0.38;
    else if (age >= 32) marketValue *= 0.58;
    else if (age >= 29) marketValue *= 0.82;

    if (
      [
        "premier league",
        "laliga",
        "serie a",
        "bundesliga",
        "ligue 1",
      ].includes(league)
    ) {
      marketValue *= 1.08;
    } else if (
      [
        "super lig",
        "eredivisie",
        "liga portugal",
        "argentina primera division",
        "campeonato brasileiro serie a",
      ].includes(league)
    ) {
      marketValue *= 0.9;
    }

    return Math.max(500000, Math.round(marketValue / 250000) * 250000);
  },

  getRegulatorySalaryEstimate(item = {}) {
    const playerName =
      item.player || item.Jogador || item.name || item.playerName || "";
    if (!String(playerName).trim()) return null;

    const club = App.transfers.normalizeSalaryLookup(
      item.fromClub || item.ClubeOrigem || item.club || item.clubName || "",
    );
    const league = App.transfers.normalizeSalaryLookup(item.league || "");
    const position = String(item.position || "").trim().toUpperCase();
    const overall = App.transfers.getResolvedOverall(item);
    const marketValue = Math.max(
      0,
      Number(
        item.marketValue ||
          item.market_value_eur ||
          item.ValorTransfermarkt ||
          0,
      ) || 0,
    );
    const age = Number(item.age || 0);

    let leagueFloor = 8000;
    let leagueFactor = 1;
    if (
      ["premier league", "laliga", "serie a", "bundesliga", "ligue 1"].includes(
        league,
      )
    ) {
      leagueFloor = 35000;
      leagueFactor = 1.18;
    } else if (league === "saudi pro league") {
      leagueFloor = 75000;
      leagueFactor = 1.35;
    } else if (league === "major league soccer") {
      leagueFloor = 28000;
      leagueFactor = 1.05;
    } else if (["eredivisie", "liga portugal", "super lig"].includes(league)) {
      leagueFloor = 22000;
      leagueFactor = 0.95;
    } else if (
      [
        "jupiler pro league",
        "scottish premiership",
        "premier liga",
        "campeonato brasileiro serie a",
        "argentina primera division",
      ].includes(league)
    ) {
      leagueFloor = 14000;
      leagueFactor = 0.82;
    } else if (["base atual da liga", "championship"].includes(league)) {
      leagueFloor = 9000;
      leagueFactor = 0.72;
    }

    let clubFloor = 0;
    let clubFactor = 1;
    if (/al\s?nassr|al\s?hilal|al\s?ittihad|al\s?ahli/.test(club)) {
      clubFloor = 180000;
      clubFactor = 1.45;
    } else if (
      /real madrid|barcelona|manchester city|manchester united|liverpool|arsenal|chelsea|tottenham|paris saint|psg|bayern|juventus|inter|internazionale|milan|atletico madrid/.test(
        club,
      )
    ) {
      clubFloor = 120000;
      clubFactor = 1.35;
    } else if (
      /borussia dortmund|bayer leverkusen|rb leipzig|leipzig|napoli|roma|lazio|ajax|psv|feyenoord|benfica|porto|sporting|fenerbahce|galatasaray|besiktas|sevilla|valencia|real sociedad|athletic/.test(
        club,
      )
    ) {
      clubFloor = 85000;
      clubFactor = 1.15;
    }

    const positionFactor = ["ST", "CF", "LW", "RW", "CAM"].includes(position)
      ? 1.08
      : ["CM", "CDM", "LM", "RM"].includes(position)
        ? 1.02
        : position === "GK"
          ? 0.96
          : 1;
    const ageFactor =
      age >= 24 && age <= 31
        ? 1.08
        : age >= 35
          ? 0.92
          : age >= 18 && age <= 21
            ? 0.86
            : 1;
    const marketRate =
      marketValue >= 100000000
        ? 0.075
        : marketValue >= 50000000
          ? 0.065
          : marketValue >= 25000000
            ? 0.055
            : marketValue >= 10000000
              ? 0.045
              : marketValue >= 5000000
                ? 0.0375
                : marketValue >= 1000000
                  ? 0.03
                  : 0.0225;
    const marketWeekly = Math.round((marketValue * marketRate) / 52);
    const overallWeekly =
      overall >= 91
        ? 420000
        : overall >= 89
          ? 320000
          : overall >= 87
            ? 240000
            : overall >= 85
              ? 165000
              : overall >= 83
                ? 125000
                : overall >= 81
                  ? 90000
                  : overall >= 79
                    ? 70000
                    : overall >= 76
                      ? 46000
                      : overall >= 73
                        ? 30000
                        : overall >= 70
                          ? 21000
                          : overall >= 66
                            ? 14000
                            : overall > 0
                              ? 9000
                              : 0;
    const starFloor =
      overall >= 89
        ? 260000
        : overall >= 87
          ? 200000
          : overall >= 85
            ? 145000
            : overall >= 83
              ? 110000
              : overall >= 81
                ? 85000
                : overall >= 79
                  ? 65000
                  : 0;
    const salary = Math.max(
      1500,
      leagueFloor,
      clubFloor,
      marketWeekly,
      starFloor,
      Math.round(
        overallWeekly *
          leagueFactor *
          clubFactor *
          positionFactor *
          ageFactor,
      ),
    );

    return {
      ok: true,
      weeklySalary: Math.round(salary / 500) * 500,
      salarySourceName: "Estimativa regulatoria da liga",
      salarySourceUrl: App.transfers.getRegulatorySalaryModelUrl(),
      referenceType: "regulatory_estimate",
    };
  },

  getComparableSalarySamples() {
    const salaryReferences = Array.isArray(App.state.apiSalaryReferences)
      ? App.state.apiSalaryReferences
      : [];
    const marketPlayers = Array.isArray(App.state.apiMarketPlayers)
      ? App.state.apiMarketPlayers
      : [];
    const transfers = Array.isArray(App.state.apiTransfers)
      ? App.state.apiTransfers
      : [];
    const ratings = Array.isArray(App.state.apiRatings)
      ? App.state.apiRatings
      : [];
    const cached = App.transfers.comparableSalarySampleCache;

    if (
      cached &&
      cached.salaryReferences === salaryReferences &&
      cached.marketPlayers === marketPlayers &&
      cached.transfers === transfers &&
      cached.ratings === ratings
    ) {
      return cached.samples;
    }

    const samplesByKey = new Map();
    const addSample = (sample = {}, options = {}) => {
      const weeklySalary = Number(
        sample.weeklySalary ||
          sample.weekly_salary_eur ||
          sample.SalarioSemanal ||
          0,
      );
      if (weeklySalary <= 0) return;

      const sampleName =
        sample.player ||
        sample.playerName ||
        sample.player_name ||
        sample.name ||
        sample.Jogador ||
        "";
      const sampleClub =
        sample.club ||
        sample.clubName ||
        sample.club_name ||
        sample.fromClub ||
        sample.ClubeOrigem ||
        "";
      const key = [
        App.transfers.normalizeSalaryLookup(sampleName),
        App.transfers.normalizeSalaryLookup(sampleClub),
      ].join("|");
      if (!key.trim() || samplesByKey.has(key)) return;

      let overall = Number(sample.overall || sample.Overall || 0);
      let position = String(sample.position || sample.Position || "")
        .trim()
        .toUpperCase();
      let league = App.transfers.normalizeSalaryLookup(sample.league || "");
      let marketPlayer = null;
      let rating = null;

      if (
        options.allowLookup !== false &&
        (!overall || !position || !league)
      ) {
        marketPlayer =
          App.transfers.findMarketPlayerByName(sampleName, {
            club: sampleClub,
          }) || {};
        rating =
          App.transfers.findEaRatingForMarketPlayer(
            marketPlayer?.name
              ? marketPlayer
              : { name: sampleName, club: sampleClub },
          ) || {};
        overall = Number(overall || rating.overall || 0);
        position = String(position || rating.position || marketPlayer.position || "")
          .trim()
          .toUpperCase();
        league = App.transfers.normalizeSalaryLookup(
          league || marketPlayer.league || "",
        );
      }

      if (overall <= 0) return;

      samplesByKey.set(key, {
        weeklySalary,
        overall,
        position,
        league,
      });
    };

    salaryReferences.forEach((reference) =>
      addSample(reference, { allowLookup: false }),
    );
    marketPlayers.forEach((marketPlayer) =>
      addSample(marketPlayer, { allowLookup: true }),
    );
    transfers.forEach((transfer) =>
      addSample(transfer, { allowLookup: true }),
    );

    const samples = [...samplesByKey.values()];
    App.transfers.comparableSalarySampleCache = {
      salaryReferences,
      marketPlayers,
      transfers,
      ratings,
      samples,
    };
    App.transfers.comparableSalaryEstimateCache = new Map();
    return samples;
  },

  getComparableSalaryEstimateCacheKey(item = {}, targetOverall = 0) {
    return [
      App.transfers.normalizeSalaryLookup(
        item.player || item.Jogador || item.name || item.playerName || "",
      ),
      App.transfers.normalizeSalaryLookup(
        item.fromClub || item.ClubeOrigem || item.club || item.clubName || "",
      ),
      Number(targetOverall || 0),
      String(item.position || "").trim().toUpperCase(),
      App.transfers.normalizeSalaryLookup(item.league || ""),
      Math.round(
        Number(
          item.marketValue ||
            item.market_value_eur ||
            item.ValorTransfermarkt ||
            0,
        ) || 0,
      ),
    ].join("|");
  },

  getComparableOverallSalaryEstimate(item = {}) {
    const playerName =
      item.player || item.Jogador || item.name || item.playerName || "";
    if (!String(playerName).trim()) return null;

    const targetOverall = Number(App.transfers.getResolvedOverall(item) || 0);
    if (targetOverall <= 0) return App.transfers.getRegulatorySalaryEstimate(item);

    const cacheKey = App.transfers.getComparableSalaryEstimateCacheKey(
      item,
      targetOverall,
    );
    if (
      App.transfers.comparableSalaryEstimateCache &&
      App.transfers.comparableSalaryEstimateCache.has(cacheKey)
    ) {
      return App.transfers.comparableSalaryEstimateCache.get(cacheKey);
    }

    const targetPosition = String(item.position || "").trim().toUpperCase();
    const targetLeague = App.transfers.normalizeSalaryLookup(item.league || "");
    const regulatory = App.transfers.getRegulatorySalaryEstimate(item);
    const samples = App.transfers.getComparableSalarySamples();
    if (!samples.length) {
      App.transfers.comparableSalaryEstimateCache?.set(cacheKey, regulatory);
      return regulatory;
    }

    const pickSamples = (maxOverallDiff, requirePosition = false) =>
      samples.filter((sample) => {
        if (Math.abs(Number(sample.overall || 0) - targetOverall) > maxOverallDiff) {
          return false;
        }
        if (
          requirePosition &&
          targetPosition &&
          sample.position &&
          targetPosition !== sample.position
        ) {
          return false;
        }
        return true;
      });

    let peers =
      pickSamples(1, true).length >= 3
        ? pickSamples(1, true)
        : pickSamples(2, true).length >= 3
          ? pickSamples(2, true)
          : pickSamples(2, false).length >= 3
            ? pickSamples(2, false)
            : pickSamples(4, false).length
              ? pickSamples(4, false)
              : samples;

    const sorted = peers
      .map((sample) => {
        const diff = targetOverall - Number(sample.overall || targetOverall);
        let adjusted = Number(sample.weeklySalary || 0) * Math.pow(1.08, diff);
        if (targetLeague && sample.league && targetLeague !== sample.league) {
          adjusted *= targetLeague === "championship" ? 0.9 : 1;
        }
        return adjusted;
      })
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((left, right) => left - right);
    if (!sorted.length) {
      App.transfers.comparableSalaryEstimateCache?.set(cacheKey, regulatory);
      return regulatory;
    }

    const middle = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
    const regulatoryFloor = Number(regulatory?.weeklySalary || 0);
    const weeklySalary = Math.round(Math.max(median, regulatoryFloor, 1500) / 500) * 500;

    const estimate = {
      ok: true,
      weeklySalary,
      salarySourceName: "Estimativa por OVR da liga",
      salarySourceUrl: App.transfers.getRegulatorySalaryModelUrl(),
      referenceType: "league_smart_estimate",
      comparableCount: peers.length,
    };
    App.transfers.comparableSalaryEstimateCache?.set(cacheKey, estimate);
    return estimate;
  },

  buildPublicSalaryReferenceIndex() {
    const refs = Array.isArray(App.state.apiSalaryReferences)
      ? App.state.apiSalaryReferences
      : [];
    if (
      App.transfers.publicSalaryReferenceIndex &&
      App.transfers.publicSalaryReferenceIndexSource === refs
    ) {
      return App.transfers.publicSalaryReferenceIndex;
    }

    const index = new Map();
    refs.forEach((item) => {
      const key = App.transfers.normalizeSalaryLookup(
        item.playerName || item.player_name,
      );
      if (!key) return;
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(item);
    });

    App.transfers.publicSalaryReferenceIndex = index;
    App.transfers.publicSalaryReferenceIndexSource = refs;
    return index;
  },

  scorePublicSalaryReference(reference = {}, playerKey = "", clubKey = "") {
    const referencePlayerKey = App.transfers.normalizeSalaryLookup(
      reference.playerName || reference.player_name,
    );
    const referenceClubKey = App.transfers.normalizeSalaryLookup(
      reference.clubName || reference.club_name,
    );
    const checkedAt = new Date(
      reference.salaryCheckedAt || reference.source_checked_at || 0,
    ).getTime();
    const checkedScore = Number.isNaN(checkedAt) ? 0 : checkedAt;

    return [
      referencePlayerKey === playerKey ? 1 : 0,
      clubKey && referenceClubKey === clubKey ? 1 : 0,
      checkedScore,
    ];
  },

  findPublicSalaryReference(playerName = "", clubName = "") {
    const aliasKeys = App.transfers
      .getPlayerSearchAliases(playerName)
      .map((name) => App.transfers.normalizeSalaryLookup(name))
      .filter(Boolean);
    const playerKey = aliasKeys[0] || App.transfers.normalizeSalaryLookup(playerName);
    const clubKey = App.transfers.normalizeSalaryLookup(clubName);
    if (!playerKey) return null;

    const index = App.transfers.buildPublicSalaryReferenceIndex();
    const byIdentity = new Map();

    aliasKeys.forEach((aliasKey) => {
      const directMatches = index.get(aliasKey) || [];
      directMatches.forEach((item) => {
        const identity = `${item.id || ""}|${item.playerName || item.player_name || ""}|${item.clubName || item.club_name || ""}`;
        if (identity) byIdentity.set(identity, item);
      });
    });

    if (!byIdentity.size) {
      for (const [itemKey, items] of index.entries()) {
        const trusted = aliasKeys.some(
          (aliasKey) =>
            App.transfers.isTrustedPlayerNameMatch(aliasKey, itemKey) ||
            App.transfers.isTrustedPlayerNameMatch(itemKey, aliasKey),
        );
        if (!trusted) continue;
        items.forEach((item) => {
          const identity = `${item.id || ""}|${item.playerName || item.player_name || ""}|${item.clubName || item.club_name || ""}`;
          if (identity) byIdentity.set(identity, item);
        });
      }
    }

    const matches = [...byIdentity.values()];
    if (!matches.length) return null;

    return (
      [...matches].sort((left, right) => {
        const leftScore = App.transfers.scorePublicSalaryReference(
          left,
          playerKey,
          clubKey,
        );
        const rightScore = App.transfers.scorePublicSalaryReference(
          right,
          playerKey,
          clubKey,
        );
        if (leftScore[0] !== rightScore[0]) return rightScore[0] - leftScore[0];
        if (leftScore[1] !== rightScore[1]) return rightScore[1] - leftScore[1];
        return rightScore[2] - leftScore[2];
      })[0] || null
    );
  },

  getStoredPublicSalaryReference(item = {}, options = {}) {
    const weeklySalary = Number(
      item.weeklySalary ??
        item.salaryWeekly ??
        item.SalarioSemanal ??
        item.weekly_salary_eur ??
        0,
    );
    const salarySourceName =
      item.salarySourceName ||
      item.FonteSalario ||
      item.salary_source_name ||
      "";
    const salarySourceUrl =
      item.salarySourceUrl ||
      item.UrlFonteSalario ||
      item.salary_source_url ||
      "";
    const referenceType =
      item.referenceType ||
      item.salaryReferenceType ||
      item.salary_reference_type ||
      "";
    const normalizedSalarySourceUrl =
      App.transfers.normalizeSalaryUrl(salarySourceUrl);
    const allowBareStoredSalary = options.allowBareStoredSalary === true;
    const hasStoredSalaryField =
      item.weeklySalary !== undefined ||
      item.salaryWeekly !== undefined ||
      item.SalarioSemanal !== undefined ||
      item.weekly_salary_eur !== undefined;
    const shouldTrustStoredSalary =
      weeklySalary > 0 &&
      ((String(salarySourceName).trim() &&
        (App.transfers.isPublicSalaryUrl(normalizedSalarySourceUrl) ||
          App.transfers.isEstimatedSalaryReference(item))) ||
        (allowBareStoredSalary && hasStoredSalaryField));

    if (!shouldTrustStoredSalary) return null;

    return {
      ok: true,
      weeklySalary,
      salarySourceName: String(
        salarySourceName || (allowBareStoredSalary ? "Salario ja carregado" : ""),
      ).trim(),
      salarySourceUrl: normalizedSalarySourceUrl,
      referenceType: referenceType || (allowBareStoredSalary ? "loaded_salary" : ""),
    };
  },

  getSalaryReferenceFromItem(item = {}, options = {}) {
    const storedReference = App.transfers.getStoredPublicSalaryReference(
      item,
      options,
    );
    if (storedReference) return storedReference;

    const publicRef = App.transfers.findPublicSalaryReference(
      item.player || item.Jogador || item.name || item.playerName,
      item.fromClub || item.ClubeOrigem || item.club || item.clubName,
    );
    if (publicRef && Number(publicRef.weeklySalary || 0) > 0) {
      return {
        ok: true,
        weeklySalary: Number(publicRef.weeklySalary || 0),
        salarySourceName: publicRef.salarySourceName || publicRef.sourceName || "",
        salarySourceUrl: publicRef.salarySourceUrl || publicRef.sourceUrl || "",
        referenceType:
          publicRef.referenceType || publicRef.salaryReferenceType || "",
      };
    }

    if (options.allowComparableEstimate === false) {
      return (
        App.transfers.getRegulatorySalaryEstimate(item) || {
          ok: false,
          weeklySalary: 0,
          salarySourceName: "",
          salarySourceUrl: "",
        }
      );
    }

    const comparable = App.transfers.getComparableOverallSalaryEstimate(item);
    if (comparable) {
      const cacheKey = App.transfers.getComparableSalaryEstimateCacheKey(
        item,
        App.transfers.getResolvedOverall(item),
      );
      App.transfers.comparableSalaryEstimateCache?.set(cacheKey, comparable);
      return comparable;
    }

    return {
      ok: false,
      weeklySalary: 0,
      salarySourceName: "",
      salarySourceUrl: "",
    };
  },

  getVerifiedWeeklySalary(item = {}) {
    const reference = App.transfers.getSalaryReferenceFromItem(item);
    return reference.ok ? Number(reference.weeklySalary || 0) : 0;
  },

  clearSalaryReferenceFromForm(form) {
    if (!form) return;
    if (form.elements.weeklySalary) form.elements.weeklySalary.value = "";
    if (form.elements.salarySourceName) form.elements.salarySourceName.value = "";
    if (form.elements.salarySourceUrl) form.elements.salarySourceUrl.value = "";
  },

  applyOverallToForm(form, overall = 0) {
    if (!form?.elements?.overall) return;
    form.elements.overall.value = Number(overall || 0) > 0 ? Number(overall) : "";
  },

  setSelectedTransferContext(form, player = {}) {
    if (!form) return;
    try {
      form.dataset.selectedTransferContext = encodeURIComponent(
        JSON.stringify(player || {}),
      );
    } catch (_) {
      delete form.dataset.selectedTransferContext;
    }
  },

  getSelectedTransferContext(form) {
    if (!form?.dataset?.selectedTransferContext) return null;
    try {
      const parsed = JSON.parse(
        decodeURIComponent(form.dataset.selectedTransferContext),
      );
      const formPlayer = App.utils.normalizeText(form.elements.player?.value || "");
      const formClub = App.utils.normalizeText(form.elements.fromClub?.value || "");
      const parsedPlayer = App.utils.normalizeText(
        parsed.player || parsed.name || "",
      );
      const parsedClub = App.utils.normalizeText(
        parsed.fromClub || parsed.club || "",
      );
      if (formPlayer && parsedPlayer && formPlayer !== parsedPlayer) return null;
      if (formClub && parsedClub && formClub !== parsedClub) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  },

  applySalaryReferenceToForm(form, reference = {}) {
    if (!form) return;
    if (!reference || Number(reference.weeklySalary || 0) <= 0) {
      App.transfers.clearSalaryReferenceFromForm(form);
      return;
    }
    if (form.elements.weeklySalary) {
      App.transfers.setWeeklySalaryInputValue(
        form,
        Math.round(Number(reference.weeklySalary || 0)),
      );
    }
    if (form.elements.salarySourceName) {
      form.elements.salarySourceName.value =
        reference.salarySourceName || reference.sourceName || "";
    }
    if (form.elements.salarySourceUrl) {
      form.elements.salarySourceUrl.value =
        reference.salarySourceUrl || reference.sourceUrl || "";
    }
  },

  async refreshSalaryQuoteForForm(form, basePlayer = {}) {
    if (!form) return null;
    if (App.transfers.isInternalTransferForm(form)) return null;

    const selectedContext = App.transfers.getSelectedTransferContext(form) || {};
    const base = {
      ...selectedContext,
      ...basePlayer,
    };
    const marketValue = Number(
      form.elements.marketValue?.value ||
        base.marketValue ||
        base.market_value_eur ||
        0,
    );
    const overall = App.transfers.getResolvedOverall({
      ...base,
      player: form.elements.player?.value || base.player || base.name || "",
      name: form.elements.player?.value || base.name || base.player || "",
      fromClub: form.elements.fromClub?.value || base.fromClub || base.club || "",
      club: form.elements.fromClub?.value || base.club || base.fromClub || "",
      overall: Number(form.elements.overall?.value || base.overall || 0),
      marketValue,
    });

    const payload = {
      name: App.transfers.sanitizePlayerSearchText(
        form.elements.player?.value || base.name || base.player || "",
      ),
      club: form.elements.fromClub?.value || base.club || base.fromClub || "",
      league: base.league || "",
      position: base.position || "",
      age: base.age || null,
      overall,
      marketValue,
    };
    if (!payload.name || !payload.club) {
      App.transfers.clearSalaryReferenceFromForm(form);
      return null;
    }

    const localReference = App.transfers.getSalaryReferenceFromItem(payload);
    if (localReference.ok) {
      App.transfers.applySalaryReferenceToForm(form, localReference);
      App.transfers.renderTransferPreview(form);
      return localReference;
    }

    if (!App.api?.getPlayerSalaryQuote) {
      App.transfers.clearSalaryReferenceFromForm(form);
      App.transfers.renderTransferPreview(form);
      return null;
    }

    const key = [
      payload.name,
      payload.club,
      payload.overall,
      payload.marketValue,
    ].join("|");
    form.dataset.salaryQuotePending = key;

    try {
      const quote = await App.api.getPlayerSalaryQuote(payload);
      if (form.dataset.salaryQuotePending !== key) return null;
      const shouldApplyQuote =
        Number(quote?.weeklySalary || 0) > 0 &&
        (App.transfers.isPublicSalaryUrl(
          quote?.salarySourceUrl || quote?.sourceUrl || "",
        ) ||
          App.transfers.isEstimatedSalaryReference(quote));
      if (shouldApplyQuote) {
        App.transfers.applySalaryReferenceToForm(form, quote);
      } else {
        App.transfers.clearSalaryReferenceFromForm(form);
      }
      App.transfers.renderTransferPreview(form);
      return shouldApplyQuote ? quote : null;
    } catch (error) {
      console.warn("Cotacao salarial publica indisponivel:", error);
      App.transfers.clearSalaryReferenceFromForm(form);
      App.transfers.renderTransferPreview(form);
      return null;
    } finally {
      if (form.dataset.salaryQuotePending === key) {
        delete form.dataset.salaryQuotePending;
      }
    }
  },

  getAuctionCandidates() {
    return App.transfers
      .getValidTransfers()
      .filter((item) => !App.transfers.isCpuSaleTransfer(item))
      .filter(
        (item) =>
          Number(item.totalCost || 0) >= 25000000 ||
          Number(item.overall || 0) >= 88,
      )
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 5);
  },

  getFairPlayWatchlist() {
    return App.transfers
      .getSpendingSummary()
      .map((item) => {
        const usage = item.totalBudget > 0 ? item.spent / item.totalBudget : 0;
        const severity = item.marketEmbargo
          ? "Embargo"
          : item.remaining < 0
            ? "Crítico"
            : item.payrollPressure >= 0.18
              ? "Folha alta"
              : usage >= 0.9
                ? "Alto"
                : usage >= 0.75
                  ? "Atenção"
                  : "OK";
        return { ...item, usage, severity };
      })
      .filter((item) => item.severity !== "OK")
      .sort((a, b) => b.usage - a.usage || a.remaining - b.remaining);
  },

  findExistingPlayer(playerName) {
    const key = App.utils.normalizeText(playerName);
    if (!key) return null;
    return (
      App.transfers
        .getValidTransfers()
        .find(
          (item) =>
            !App.transfers.isCpuSaleTransfer(item) &&
            App.utils.normalizeText(item.player) === key,
        ) || null
    );
  },

  isInternalTransferForm(form) {
    return form?.elements.transferType?.value === "internal";
  },

  syncTransferBuyerScope(form = document.getElementById("transferForm")) {
    if (!form?.elements?.buyer) return;
    const session = App.auth?.getSession?.() || null;
    const isCommissioner = App.auth?.isCommissioner?.() === true;
    const buyerField = form.elements.buyer;
    const buyerLabel = buyerField.closest("label");
    const confirmField = form.elements.confirmTransferBuyer;
    const confirmLabel = confirmField?.closest("label");
    const setScopedFieldVisibility = (label, hidden) => {
      if (!label) return;
      label.hidden = hidden;
      label.setAttribute("aria-hidden", hidden ? "true" : "false");
      label.style.display = hidden ? "none" : "";
    };

    if (session?.managerName && !isCommissioner) {
      buyerField.value = session.managerName;
      buyerField.dataset.sessionLocked = "true";
      setScopedFieldVisibility(buyerLabel, true);
      if (confirmField) {
        confirmField.checked = true;
        confirmField.dataset.sessionLocked = "true";
      }
      setScopedFieldVisibility(confirmLabel, true);
    } else {
      delete buyerField.dataset.sessionLocked;
      setScopedFieldVisibility(buyerLabel, false);
      if (confirmField) delete confirmField.dataset.sessionLocked;
      setScopedFieldVisibility(confirmLabel, false);
    }
  },

  getOwnedTransfersByBuyer(buyer) {
    return App.transfers
      .getValidTransfers()
      .filter((item) => item.buyer === buyer)
      .sort((a, b) => a.player.localeCompare(b.player));
  },

  hydrateRosterPlayer(item = {}, context = {}) {
    const name = String(item.name || item.player || item.playerName || "").trim();
    if (!name) return null;

    const fallbackClub = String(
      context.club || context.owner || context.managerName || "",
    ).trim();
    const clubName = String(
      item.clubName ||
        item.club ||
        item.fromClub ||
        item.from_club ||
        fallbackClub,
    ).trim();
    const marketPlayer =
      App.transfers.findMarketPlayerByName(name, {
        club: clubName,
      }) || null;
    const rating =
      App.transfers.getRatingForPlayerName(name, {
        club: clubName,
      }) || null;
    const marketValue = Math.max(
      0,
      Number(
        item.marketValue ||
          item.market_value_eur ||
          item.totalCost ||
          item.baseValue ||
          item.sourceMarketValue ||
          marketPlayer?.market_value_eur ||
          0,
      ),
    );
    const resolvedClub = clubName || marketPlayer?.club || "";
    const overall = App.transfers.getResolvedOverall({
      ...marketPlayer,
      ...item,
      player: name,
      name,
      club: resolvedClub,
      fromClub: resolvedClub,
      marketValue,
    });
    const salaryReference = App.transfers.getSalaryReferenceFromItem(
      {
      ...marketPlayer,
      ...item,
      player: name,
      name,
      club: resolvedClub,
      fromClub: resolvedClub,
      overall,
      marketValue,
      },
      {
        allowBareStoredSalary:
          context.allowBareStoredSalary === true ||
          Boolean(context.owner || context.managerName),
        allowComparableEstimate:
          context.allowComparableSalaryEstimate !== false,
      },
    );
    const storedSalaryReference = App.transfers.getStoredPublicSalaryReference(
      item,
      {
        allowBareStoredSalary:
          context.allowBareStoredSalary === true ||
          Boolean(context.owner || context.managerName),
      },
    );

    return {
      ...item,
      name,
      player: item.player || name,
      playerName: item.playerName || name,
      clubName: item.clubName || resolvedClub,
      club: item.club || resolvedClub,
      fromClub: item.fromClub || item.from_club || resolvedClub,
      position: item.position || rating?.position || marketPlayer?.position || "",
      overall,
      marketValue,
      weeklySalary: Number(salaryReference.weeklySalary || 0),
      salarySourceName:
        salaryReference.salarySourceName ||
        storedSalaryReference?.salarySourceName ||
        "",
      salarySourceUrl:
        salaryReference.salarySourceUrl ||
        storedSalaryReference?.salarySourceUrl ||
        "",
      salaryReferenceType:
        salaryReference.referenceType ||
        storedSalaryReference?.referenceType ||
        "",
      avatarUrl:
        item.avatarUrl || rating?.avatar_url || marketPlayer?.avatar_url || "",
    };
  },

  normalizeRosterPoolPlayer(item = {}, owner = "") {
    const base = App.transfers.hydrateRosterPlayer(item, {
      owner,
      allowBareStoredSalary: true,
      allowComparableSalaryEstimate: false,
      club:
        item.fromClub || item.from_club || item.club || item.clubName || owner,
    });
    if (!base) return null;
    return {
      ...base,
      id:
        item.id ||
        `${App.utils.normalizeText(owner)}:${App.utils.normalizeText(base.name)}`,
      buyer: owner,
      fromClub: base.fromClub || base.club || owner,
      club: base.club || base.fromClub || owner,
      totalCost: Number(base.totalCost || base.marketValue || 0),
      marketValue: Number(base.marketValue || base.totalCost || 0),
      listed: Boolean(item.listed),
      isStarter: Boolean(item.isStarter || item.is_starting),
    };
  },

  getRosterPlayersByManager(owner = "") {
    if (!owner) return [];
    const snapshot = App.transfers.getBuyerRosterSnapshot?.(owner) || {};
    const roster = Array.isArray(snapshot.roster) ? snapshot.roster : [];
    const mappedRoster = roster
      .map((item) => App.transfers.normalizeRosterPoolPlayer(item, owner))
      .filter(Boolean);
    if (mappedRoster.length) {
      return mappedRoster.sort((a, b) =>
        String(a.player || "").localeCompare(String(b.player || ""), "pt-BR"),
      );
    }
    return App.transfers
      .getOwnedTransfersByBuyer(owner)
      .map((item) => App.transfers.normalizeRosterPoolPlayer(item, owner))
      .filter(Boolean)
      .sort((a, b) =>
        String(a.player || "").localeCompare(String(b.player || ""), "pt-BR"),
      );
  },

  getInternalTransferPlayerByIndex(seller, index) {
    if (index === "" || index === undefined || index === null) return null;
    return App.transfers.getRosterPlayersByManager(seller)[Number(index)] || null;
  },

  getExchangePlayerByIndex(buyer, index) {
    if (index === "" || index === undefined || index === null) return null;
    return App.transfers.getRosterPlayersByManager(buyer)[Number(index)] || null;
  },

  getExchangeCredit(grossValue, exchangeValue) {
    const gross = Number(grossValue || 0);
    const value = Number(exchangeValue || 0);
    if (gross <= 0 || value <= 0) return 0;
    const credit = Math.min(gross * 0.7, value * 0.85);
    return Math.round(credit / 100000) * 100000;
  },

  getTransferPreview(form) {
    if (!form) return null;

    const buyer = form.elements.buyer?.value || "";
    const seller = form.elements.seller?.value || "";
    const isInternal = App.transfers.isInternalTransferForm(form);
    const player = form.elements.player?.value || "";
    const fromClub = form.elements.fromClub?.value || "";
    const overall = Number(form.elements.overall?.value);
    const marketValue = Number(form.elements.marketValue?.value);
    const rawOfferValue = App.transfers.parseTransferMoneyInput(
      form.elements.offerValue?.value,
    );
    const hasOfferValue =
      !Number.isNaN(rawOfferValue) && Number(rawOfferValue || 0) > 0;
    const manualSalaryReference = {
      player,
      fromClub,
      overall,
      marketValue,
      weeklySalary: App.transfers.getWeeklySalaryInputValue(form),
      salarySourceName: form.elements.salarySourceName?.value || "",
      salarySourceUrl: form.elements.salarySourceUrl?.value || "",
    };
    const hasEnoughData = Boolean(
      buyer &&
      player &&
      !Number.isNaN(overall) &&
      !Number.isNaN(marketValue) &&
      overall > 0 &&
      (isInternal ? marketValue >= 0 : marketValue > 0),
    );
    const budget = App.transfers
      .getSpendingSummary()
      .find((item) => item.buyer === buyer);
    const rate =
      Number.isNaN(overall) || isInternal
        ? 0
        : App.transfers.getTransferRate(overall);
    const sellerExpectationRate =
      Number.isNaN(overall) || isInternal
        ? 0
        : App.transfers.getExternalSellerExpectationRate(overall);
    const sellerExpectationValue =
      Number.isNaN(marketValue) || isInternal
        ? 0
        : App.transfers.roundTransferOfferValue(
            marketValue + marketValue * sellerExpectationRate,
          );
    const finalValue = Number.isNaN(marketValue)
      ? 0
      : isInternal
        ? marketValue + marketValue * rate
        : App.transfers.roundTransferOfferValue(
            hasOfferValue ? rawOfferValue : marketValue,
          );
    const offerDelta = !isInternal ? finalValue - marketValue : 0;
    const offerRatio =
      !isInternal && marketValue > 0 ? finalValue / marketValue : 1;
    const exchangePlayer = !isInternal
      ? App.transfers.getExchangePlayerByIndex(
          buyer,
          form.elements.exchangePlayer?.value,
        )
      : null;
    const exchangeValue = Number(
      exchangePlayer?.totalCost || exchangePlayer?.marketValue || 0,
    );
    const exchangeCredit = exchangePlayer
      ? App.transfers.getExchangeCredit(finalValue, exchangeValue)
      : 0;
    const exchangeSamePlayer = Boolean(
      exchangePlayer &&
      App.transfers.normalizePlayerRatingKey(exchangePlayer.player) ===
        App.transfers.normalizePlayerRatingKey(player),
    );
    const cashFinalValue = Math.max(0, finalValue - exchangeCredit);
    const internalTransfer = isInternal
      ? App.transfers.getInternalTransferPlayerByIndex(
          seller,
          form.elements.internalPlayer?.value,
        )
      : null;
    const salaryReference = isInternal
      ? App.transfers.getSalaryReferenceFromItem(internalTransfer || {})
      : App.transfers.getSalaryReferenceFromItem(manualSalaryReference);
    const weeklySalary = salaryReference.ok
      ? Number(salaryReference.weeklySalary || 0)
      : 0;
    const salaryReferenceMissing = Boolean(
      !isInternal && hasEnoughData && !salaryReference.ok,
    );
    const duplicate = App.transfers.findExistingPlayer(player);
    const internalSellerMismatch = Boolean(
      isInternal && duplicate && seller && duplicate.buyer !== seller,
    );
    const sameBuyerAndSeller = Boolean(
      isInternal && buyer && seller && buyer === seller,
    );
    const duplicateBlock = duplicate && (!isInternal || internalSellerMismatch);
    const remainingAfter = budget ? budget.remaining - cashFinalValue : 0;
    const payrollAfter = Number(budget?.payrollWeekly || 0) + weeklySalary;
    const maxPayrollRatio = Number(
      App.state.apiFinanceRules?.max_payroll_to_budget_ratio || 0.22,
    );
    const payrollCeiling =
      (Number(budget?.totalBudget || App.config.transferBudget) *
        maxPayrollRatio) /
      4;
    const payrollBlocked = payrollAfter > payrollCeiling;
    const marketEmbargo = Boolean(
      budget?.marketEmbargo ||
      budget?.salaryDebtActive ||
      Number(budget?.remaining || 0) < 0,
    );
    const runwayWeeksAfter =
      payrollAfter > 0
        ? Math.floor(Math.max(0, remainingAfter) / payrollAfter)
        : null;
    const limitReached =
      !isInternal && budget
        ? budget.transfersToday >= budget.transferLimit
        : false;
    const overBudget = budget ? cashFinalValue > budget.remaining : false;
    const hardBlock = Boolean(
      hasEnoughData &&
      (duplicateBlock ||
        sameBuyerAndSeller ||
        exchangeSamePlayer ||
        marketEmbargo ||
        limitReached ||
        overBudget ||
        (isInternal && payrollBlocked)),
    );

    return {
      buyer,
      seller,
      isInternal,
      player,
      fromClub,
      overall,
      marketValue,
      hasEnoughData,
      rate,
      sellerExpectationRate,
      sellerExpectationValue,
      offerDelta,
      offerRatio,
      finalValue,
      cashFinalValue,
      exchangePlayer,
      exchangeValue,
      exchangeCredit,
      exchangeSamePlayer,
      duplicate,
      duplicateBlock,
      internalSellerMismatch,
      sameBuyerAndSeller,
      budget,
      remainingAfter,
      weeklySalary,
      salarySourceName: salaryReference.salarySourceName || "",
      salarySourceUrl: salaryReference.salarySourceUrl || "",
      salaryReferenceMissing,
      payrollAfter,
      payrollCeiling,
      payrollBlocked,
      marketEmbargo,
      runwayWeeksAfter,
      limitReached,
      overBudget,
      hardBlock,
    };
  },

  async createAutoAuctionFromPreview(preview) {
    if (!preview?.duplicateBlock || preview.isInternal) {
      throw new Error(
        "Leilão automático só abre quando há disputa por jogador externo já contratado.",
      );
    }

    const result = await App.api.rpc(
      "app_create_auto_auction",
      {
        p_player_name: preview.player,
        p_buyer: preview.buyer,
        p_existing_owner: preview.duplicate?.buyer || "",
        p_overall: Number(preview.overall || 0),
        p_current_value: Number(preview.finalValue || 0),
        p_reason: "Disputa por jogador já contratado",
      },
      30000,
    );

    if (result?.ok === false)
      throw new Error(result.message || "Não foi possível abrir o leilão.");

    await App.api.loadExperienceData?.();
    App.main.renderCurrentView();
    return result;
  },

  renderTransferPreview(form) {
    const target = document.getElementById("transferFormPreview");
    if (!target || !form) return;

    const preview = App.transfers.getTransferPreview(form);
    const submitButton = form.querySelector("button[type='submit']");

    if (App.transfers.isTransferWindowLocked()) {
      if (submitButton) submitButton.disabled = true;
      target.className = "transfer-live-preview danger";
      App.dom.setHtml(
        target,
        `
        <strong>Janela de transferências fechada</strong>
        <span>${App.utils.escapeHtml(App.transfers.getTransferWindowLockMessage())}</span>
      `,
      );
      return;
    }

    if (!preview?.hasEnoughData) {
      if (submitButton && !submitButton.dataset.submitting)
        submitButton.disabled = false;
      target.className = "transfer-live-preview";
      App.dom.setHtml(
        target,
        `
        <strong>Prévia da contratação</strong>
        <span>Preencha comprador, jogador, overall e valor para calcular custo final, folha e travas antes de enviar.</span>
      `,
      );
      return;
    }

    const messages = [];

    if (preview.duplicateBlock) {
      messages.push(`Jogador já contratado por ${preview.duplicate.buyer}.`);
      if (!preview.isInternal)
        messages.push(
          "Abra um leilão automático para registrar a disputa com o comissário.",
        );
    }

    if (preview.sameBuyerAndSeller) {
      messages.push("Comprador e vendedor precisam ser técnicos diferentes.");
    }

    if (preview.exchangeSamePlayer) {
      messages.push(
        "O jogador oferecido na troca precisa ser diferente do alvo da compra.",
      );
    }

    if (preview.salaryReferenceMissing) {
      messages.push(
        "Salario publico pendente. A mesa com o clube pode abrir, mas os termos pessoais serao negociados depois da aprovacao do vendedor.",
      );
    }

    if (preview.marketEmbargo) {
      messages.push(
        "Mercado bloqueado por dívida salarial ou saldo negativo. Venda jogadores ou aguarde receita vencida.",
      );
    }

    if (
      preview.isInternal &&
      preview.duplicate &&
      !preview.internalSellerMismatch
    ) {
      messages.push(`Negociação interna saindo de ${preview.seller}.`);
      messages.push("Propostas entre técnicos não consomem limite diário.");
    }

    if (preview.limitReached) {
      if (Number(preview.budget.transferLimit || 0) <= 0) {
        messages.push(
          `Transferências externas bloqueadas hoje para ${preview.buyer}.`,
        );
      } else {
        messages.push(
          `${preview.buyer} já atingiu o limite diário (${preview.budget.transfersToday}/${preview.budget.transferLimit}).`,
        );
      }
    }

    if (preview.overBudget) {
      messages.push(
        `Saldo insuficiente: faltam ${App.utils.formatCurrency(Math.abs(preview.remainingAfter))}.`,
      );
    }

    if (preview.payrollBlocked) {
      messages.push(
        `Folha projetada acima do teto financeiro: limite recomendado ${App.utils.formatCurrency(preview.payrollCeiling)}/sem. A assinatura final pode exigir renegociar salario.`,
      );
    }

    const externalVerdict = App.transfers.getExternalOfferVerdict(preview);
    if (externalVerdict) {
      messages.push(externalVerdict.detail);
      if (Number.isFinite(externalVerdict.acceptanceProbability)) {
        messages.push(
          `Chance de aceite estimada: ${externalVerdict.acceptanceProbability}%.`,
        );
      }
    }

    if (!messages.length) {
      messages.push(
        preview.isInternal
          ? "Proposta liberada para envio."
          : "Proposta liberada para abrir negociacao.",
      );
    }

    if (
      !preview.isInternal &&
      (preview.finalValue >= 25000000 || preview.overall > 88)
    ) {
      messages.push(
        "Jogador de alto impacto: considere abrir leilão/consulta no grupo antes de confirmar.",
      );
    }

    if (preview.runwayWeeksAfter !== null && preview.runwayWeeksAfter < 3) {
      messages.push(
        "A folha pós-compra deixa pouco fôlego de caixa para as próximas semanas.",
      );
    }

    if (preview.exchangePlayer && preview.exchangeCredit > 0) {
      messages.push(
        `${preview.exchangePlayer.player} entra como troca e abate ${App.utils.formatCurrency(preview.exchangeCredit)} do pagamento em dinheiro.`,
      );
    }

    if (submitButton && !submitButton.dataset.submitting) {
      submitButton.disabled = preview.hardBlock;
    }

    const renderMetric = ({ label, value, unit = "", tone = "" }) => `
      <span class="preview-metric ${tone ? `is-${tone}` : ""}">
        <small class="preview-metric-label">${App.utils.escapeHtml(label)}</small>
        <span class="preview-metric-value">
          <strong>${App.utils.escapeHtml(String(value))}</strong>
          ${unit ? `<em>${App.utils.escapeHtml(unit)}</em>` : ""}
        </span>
      </span>
    `;
    const previewMetrics = [
      { label: "OVR", value: preview.overall },
      ...(preview.isInternal
        ? []
        : [
            {
              label: "Referencia",
              value: App.transfers.formatMarketValueDisplay(preview.marketValue),
            },
          ]),
      {
        label: preview.isInternal ? "Valor negociado" : "Oferta enviada",
        value: App.utils.formatCurrency(preview.finalValue),
        tone:
          !preview.isInternal && preview.offerDelta < 0
            ? "warning"
            : !preview.isInternal && preview.offerDelta > 0
              ? "success"
              : "",
      },
      ...(preview.isInternal
        ? []
        : [
            {
              label: "Pedido provável",
              value: preview.marketValue
                ? App.utils.formatCurrency(preview.sellerExpectationValue)
                : "N/A",
            },
            {
              label: "Tendencia",
              value: externalVerdict?.label || "Em analise",
              tone: externalVerdict?.tone || "",
            },
            {
              label: "Chance de aceite",
              value:
                externalVerdict?.acceptanceProbability === undefined
                  ? "N/A"
                  : `${externalVerdict.acceptanceProbability}%`,
              tone: externalVerdict?.tone || "",
            },
          ]),
      ...(preview.exchangePlayer
        ? [
            {
              label: "Abatimento troca",
              value: App.utils.formatCurrency(preview.exchangeCredit),
              tone: "warning",
            },
            {
              label: "Dinheiro a pagar",
              value: App.utils.formatCurrency(preview.cashFinalValue),
            },
          ]
        : []),
      {
        label: "Saldo após compra",
        value: App.utils.formatCurrency(preview.remainingAfter),
        tone: preview.remainingAfter < 0 ? "danger" : "",
      },
      {
        label: "Salario de folha",
        value: preview.salaryReferenceMissing
          ? "Pendente"
          : App.utils.formatCurrency(preview.weeklySalary),
        unit: "/sem",
        tone: preview.salaryReferenceMissing ? "danger" : "",
      },
      {
        label: "Compromisso anual",
        value: preview.salaryReferenceMissing
          ? "Pendente"
          : App.utils.formatCurrency(preview.weeklySalary * 52),
      },
      {
        label: "Folha pós-compra",
        value: App.utils.formatCurrency(preview.payrollAfter),
        unit: "/sem",
        tone: preview.payrollBlocked ? "danger" : "",
      },
      {
        label: preview.isInternal ? "Limite diário" : "Transferências hoje",
        value: preview.isInternal
          ? "Não consome"
          : `${preview.budget.transfersToday}/${preview.budget.transferLimit}`,
      },
      {
        label: "Fôlego de caixa",
        value:
          preview.runwayWeeksAfter === null
            ? "Sem folha"
            : `${preview.runwayWeeksAfter} sem.`,
        tone:
          preview.runwayWeeksAfter !== null && preview.runwayWeeksAfter < 3
            ? "warning"
            : "",
      },
    ];

    target.className = `transfer-live-preview ${preview.hardBlock ? "danger" : "success"}`;
    App.dom.setHtml(
      target,
      `
      <div class="preview-header">
        <strong>${App.utils.escapeHtml(preview.player)}</strong>
        <span>${preview.buyer}</span>
      </div>
      <div class="preview-grid">
        ${previewMetrics.map(renderMetric).join("")}
      </div>
      <ul class="preview-alerts">
        ${messages.map((message) => `<li>${App.utils.escapeHtml(message)}</li>`).join("")}
      </ul>
      ${preview.duplicateBlock && !preview.isInternal ? `<button type="button" class="secondary-button" data-open-auto-auction>Abrir leilão automático</button>` : ""}
    `,
    );
  },

  syncInternalTransferFields(form) {
    if (!form) return;

    const isInternal = App.transfers.isInternalTransferForm(form);
    const marketFields = form.querySelectorAll("[data-market-transfer-field]");
    const internalFields = form.querySelectorAll(
      "[data-internal-transfer-field]",
    );
    const valueLabel = document.getElementById("transferValueLabel");

    marketFields.forEach((element) => {
      element.hidden = isInternal;
    });
    internalFields.forEach((element) => {
      element.hidden = !isInternal;
    });
    if (valueLabel)
      valueLabel.textContent = isInternal
        ? "Valor negociado entre técnicos"
        : "Referencia de mercado";

    if (!isInternal) {
      if (form.elements.seller) form.elements.seller.value = "";
      App.transfers.populateInternalTransferPlayers(form);
      App.transfers.populateExchangePlayers(form);
      return;
    }

    App.transfers.populateInternalTransferPlayers(form);
    App.transfers.populateExchangePlayers(form);
    App.transfers.selectInternalTransferPlayer(form);
  },

  populateExchangePlayers(form) {
    const select = document.getElementById("transferExchangePlayer");
    const hint = document.getElementById("transferExchangeHint");
    if (!select || !form) return;

    const buyer = form.elements.buyer?.value || "";
    const players = buyer ? App.transfers.getRosterPlayersByManager(buyer) : [];
    const currentValue = select.value;

    App.dom.setHtml(
      select,
      `
      <option value="">Sem jogador na troca</option>
      ${players
        .map(
          (item, index) => `
        <option value="${index}">${App.utils.escapeHtml(item.player)} · ${App.utils.formatCurrency(item.totalCost)}</option>
      `,
        )
        .join("")}
    `,
    );

    if ([...select.options].some((option) => option.value === currentValue)) {
      select.value = currentValue;
    }

    if (hint) {
      hint.textContent = players.length
        ? "Opcional. O abatimento aparece na prévia antes do envio."
        : "Este comprador ainda não tem jogadores disponíveis para troca.";
    }
  },

  populateInternalTransferPlayers(form) {
    const select = document.getElementById("internalTransferPlayer");
    if (!select || !form) return;

    const seller = form.elements.seller?.value || "";
    const players = seller ? App.transfers.getRosterPlayersByManager(seller) : [];
    const currentValue = select.value;

    App.dom.setHtml(
      select,
      `
      <option value="">${seller ? "Escolha o jogador" : "Escolha vendedor e jogador"}</option>
      ${players
        .map(
          (item, index) => `
        <option value="${index}">${App.utils.escapeHtml(item.player)} · ${App.utils.formatCurrency(item.totalCost)}</option>
      `,
        )
        .join("")}
    `,
    );

    if ([...select.options].some((option) => option.value === currentValue))
      select.value = currentValue;
  },

  selectInternalTransferPlayer(form) {
    const select = document.getElementById("internalTransferPlayer");
    if (!select || !form || !App.transfers.isInternalTransferForm(form)) return;

    const seller = form.elements.seller?.value || "";
    const transfer = App.transfers.getInternalTransferPlayerByIndex(
      seller,
      select.value,
    );
    if (!transfer) return;

    if (form.elements.player)
      form.elements.player.value = transfer.player || "";
    if (form.elements.fromClub)
      form.elements.fromClub.value = `Negociação interna: ${seller}`;
    if (form.elements.overall)
      form.elements.overall.value = transfer.overall || "";
    if (form.elements.marketValue && !Number(form.elements.marketValue.value)) {
      form.elements.marketValue.value = Math.round(
        Number(transfer.marketValue || transfer.totalCost || 0),
      );
    }

    App.transfers.renderTransferPreview(form);
  },

  renderBudgetBoard() {
    const target = document.getElementById("transferBudgetBoard");
    if (!target) return;

    const data = App.transfers.getRecentTransferMovements(5);
    const impactTransfers = App.transfers.getImpactTransferSpotlights(3);
    App.transfers.hydratePlayerPortraitsForTransfers([
      ...data,
      ...impactTransfers,
    ]);

    if (!data.length) {
      App.dom.setHtml(
        target,
        `
        <article class="transfer-movement-card transfer-movement-empty">
          <div class="movement-card-header">
            <span>Movimentações recentes</span>
          </div>
          <strong>Nenhuma transferência aprovada ainda.</strong>
          <p class="calendar-muted">As últimas compras e vendas aprovadas aparecerão aqui.</p>
        </article>
      `,
      );
      return;
    }

    const impactHtml = impactTransfers.length
      ? (() => {
          const spotlight = impactTransfers[0];
          const isSpotlightSale = App.transfers.isCpuSaleTransfer(spotlight);
          const spotlightOwner = isSpotlightSale
            ? spotlight.seller || spotlight.originalBuyer || "Técnico"
            : spotlight.buyer;
          const spotlightDestination = isSpotlightSale
            ? App.transfers.getCpuSaleDestination(spotlight)
            : "";
          return `
      <article class="transfer-movement-card transfer-impact-spotlight ${isSpotlightSale ? "is-cpu-sale-transfer" : ""}">
        <div class="movement-card-header">
          <span>${isSpotlightSale ? "Venda impactante" : "Contratação impactante"}</span>
          <small>${isSpotlightSale ? `${App.utils.escapeHtml(spotlightDestination)} · OVR 89+` : "OVR 89+"}</small>
        </div>
        <div class="impact-spotlight-grid">
          <div class="impact-spotlight-main">
            ${App.transfers.renderPlayerIdentity(
              spotlight.player,
              isSpotlightSale
                ? `${spotlightOwner} vendeu para ${spotlightDestination}`
                : `${spotlight.fromClub || "Clube não informado"} · ${spotlight.buyer}`,
              "impact-player-identity",
              { club: spotlight.fromClub },
            )}
            <strong>${App.utils.formatCurrency(spotlight.totalCost)}</strong>
          </div>
          <div class="impact-spotlight-list">
            ${impactTransfers
              .map((item) => {
                const isSale = App.transfers.isCpuSaleTransfer(item);
                const owner = isSale
                  ? item.seller || item.originalBuyer || "Técnico"
                  : item.buyer;
                const destination = isSale
                  ? App.transfers.getCpuSaleDestination(item)
                  : "";
                return `
              <div>
                <span>OVR ${item.displayOverall}</span>
                <b>${App.utils.escapeHtml(item.player)}</b>
                <small>${App.utils.escapeHtml(isSale ? `${owner} -> ${destination}` : owner)} · ${App.utils.formatCurrency(item.totalCost)}</small>
              </div>
            `;
              })
              .join("")}
          </div>
        </div>
      </article>
    `;
        })()
      : "";

    App.dom.setHtml(
      target,
      impactHtml +
        data
          .map((item) => {
            const date = item.timestamp
              ? App.utils.formatDateTime(item.timestamp)
              : "Sem data";
            const overall = App.transfers.getTransferOverall(item);
            const isImpact = overall > 88;
            const isCpuSale = App.transfers.isCpuSaleTransfer(item);
            const ownerLabel = isCpuSale
              ? item.seller || item.originalBuyer || "Técnico"
              : item.buyer;
            const destinationLabel = isCpuSale
              ? App.transfers.getCpuSaleDestination(item)
              : "";
            const marketValue = Number(item.marketValue || 0);
            const feePercent = Math.round(Number(item.feeRate || 0) * 100);
            const tradeInCredit = Number(item.tradeInCredit || 0);
            const valueBreakdown = marketValue
              ? `Base ${App.utils.formatCurrency(marketValue)}${feePercent ? ` + ${feePercent}% OVR` : ""}${tradeInCredit ? ` · troca -${App.utils.formatCurrency(tradeInCredit)}` : ""}`
              : "Base não informada";
            const movementClass = [
              isImpact ? "is-impact-transfer" : "",
              isCpuSale ? "is-cpu-sale-transfer" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return `
        <article class="transfer-movement-card ${movementClass}">
          <div class="movement-card-header">
            ${App.ui.ownerBadge(ownerLabel)}
            <small>${isCpuSale ? "Venda externa · " : isImpact ? "Impactante · " : ""}${App.utils.escapeHtml(date)}</small>
          </div>
          <div class="movement-player">
            <span>${isCpuSale ? "Venda concluída" : "Contratação"}</span>
            ${App.transfers.renderPlayerIdentity(
              item.player,
              isCpuSale
                ? `${ownerLabel} vendeu para ${destinationLabel}`
                : item.fromClub || "Clube não informado",
              "movement-player-identity",
              {
                club: item.fromClub,
              },
            )}
          </div>
          <div class="movement-meta">
            <span>${App.utils.escapeHtml(isCpuSale ? `Destino: ${destinationLabel}` : item.fromClub || "Clube não informado")}</span>
            <span>OVR ${overall || "-"}</span>
          </div>
          <div class="movement-value">
            <span>${isCpuSale ? "Valor recebido" : "Valor final"}</span>
            <div class="movement-value-copy">
              <small>${App.utils.escapeHtml(isCpuSale ? `Oferta aceita de ${destinationLabel}` : valueBreakdown)}</small>
              <strong>${App.utils.formatCurrency(item.totalCost)}</strong>
            </div>
          </div>
        </article>
      `;
          })
          .join(""),
    );
  },

  renderInsights() {
    const target = document.getElementById("transferInsights");
    if (!target) return;

    const transfers = App.transfers.getValidTransfers();
    const purchases = transfers.filter(
      (item) => !App.transfers.isCpuSaleTransfer(item),
    );
    const biggest = [...purchases]
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 5);
    const recent = App.transfers.getRecentTransferMovements(5);
    const buyers = App.utils
      .getHumanBuyers()
      .map((buyer) => ({
        buyer,
        count: purchases.filter((item) => item.buyer === buyer).length,
      }))
      .sort((a, b) => b.count - a.count);
    const fromClubs = purchases.reduce((acc, item) => {
      const club = item.fromClub || "Clube não informado";
      acc[club] = (acc[club] || 0) + 1;
      return acc;
    }, {});
    const topClubs = Object.entries(fromClubs)
      .map(([club, count]) => ({ club, count }))
      .sort((a, b) => b.count - a.count || a.club.localeCompare(b.club))
      .slice(0, 5);
    const duplicateCount = App.transfers
      .getTransfersWithStats()
      .filter((item) => item.isBlockedDuplicate).length;
    const auctionCandidates = App.transfers.getAuctionCandidates();
    const fairPlayWatch = App.transfers.getFairPlayWatchlist();

    App.dom.setHtml(
      target,
      `
      <article class="transfer-insight-card">
        <h3>Maiores compras</h3>
        ${
          biggest.length
            ? biggest
                .map(
                  (item) => `
          <div class="insight-row">
            <span>${App.transfers.renderPlayerIdentity(item.player, item.buyer, "insight-player-identity")}</span>
            <strong>${App.utils.formatCurrency(item.totalCost)}</strong>
          </div>
        `,
                )
                .join("")
            : `<p class="calendar-muted">Nenhuma compra aprovada ainda.</p>`
        }
      </article>
      <article class="transfer-insight-card">
        <h3>Recentes</h3>
        ${
          recent.length
            ? recent
                .map((item) => {
                  const isCpuSale = App.transfers.isCpuSaleTransfer(item);
                  const owner = isCpuSale
                    ? item.seller || item.originalBuyer || "Técnico"
                    : item.buyer;
                  const destination = isCpuSale
                    ? App.transfers.getCpuSaleDestination(item)
                    : "";
                  return `
          <div class="insight-row">
            <span>${App.transfers.renderPlayerIdentity(item.player, isCpuSale ? `${owner} vendeu para ${destination}` : item.buyer, "insight-player-identity")}</span>
            <strong>${App.utils.escapeHtml(isCpuSale ? destination : item.buyer)}</strong>
          </div>
        `;
                })
                .join("")
            : `<p class="calendar-muted">Nenhuma movimentação recente.</p>`
        }
      </article>
      <article class="transfer-insight-card">
        <h3>Compradores</h3>
        ${buyers
          .map(
            (item) => `
          <div class="insight-row">
            <span>${item.buyer}</span>
            <strong>${item.count}</strong>
          </div>
        `,
          )
          .join("")}
      </article>
      <article class="transfer-insight-card">
        <h3>Clubes origem</h3>
        ${
          topClubs.length
            ? topClubs
                .map(
                  (item) => `
          <div class="insight-row">
            <span>${App.utils.escapeHtml(item.club)}</span>
            <strong>${item.count}</strong>
          </div>
        `,
                )
                .join("")
            : `
          <div class="insight-row">
            <span>Duplicadas bloqueadas</span>
            <strong>${duplicateCount}</strong>
          </div>
        `
        }
      </article>
      <article class="transfer-insight-card">
        <h3>Radar de leilão</h3>
        ${
          auctionCandidates.length
            ? auctionCandidates
                .map(
                  (item) => `
          <div class="insight-row">
            <span>${App.transfers.renderPlayerIdentity(item.player, item.buyer, "insight-player-identity")}</span>
            <strong>${App.utils.formatCurrency(item.totalCost)}</strong>
          </div>
        `,
                )
                .join("")
            : `<p class="calendar-muted">Nenhuma compra pesada no radar.</p>`
        }
      </article>
      <article class="transfer-insight-card">
        <h3>Fair play</h3>
        ${
          fairPlayWatch.length
            ? fairPlayWatch
                .map(
                  (item) => `
          <div class="insight-row">
            <span>${App.utils.escapeHtml(item.buyer)} · ${item.severity}</span>
            <strong>${App.utils.formatCurrency(item.remaining)}</strong>
          </div>
        `,
                )
                .join("")
            : `<p class="calendar-muted">Nenhum técnico em zona crítica.</p>`
        }
      </article>
    `,
    );
  },

  getMarketPlayers() {
    return Array.isArray(App.state.apiMarketPlayers)
      ? App.state.apiMarketPlayers
      : [];
  },

  getMarketSearchAliases(query = "") {
    const clubAliases = App.transfers.getMarketClubSearchAliases(query);
    return [
      ...new Set(
        [
          query,
          ...clubAliases,
          ...App.transfers.getPlayerSearchAliases(query),
        ].filter(Boolean),
      ),
    ].slice(0, 4);
  },

  getMarketClubSearchAliases(query = "") {
    const key = App.transfers.normalizePlayerRatingKey(query).replace(/\s+/g, " ");
    const compactKey = key.replace(/\s+/g, "");
    const aliases = {
      brent: ["Brentford", "Brentford Football Club"],
      brentford: ["Brentford Football Club"],
    };
    return aliases[key] || aliases[compactKey] || [];
  },

  sortMarketSearchAliases(query = "") {
    const scoreAlias = (value = "") => {
      const key = App.transfers.normalizePlayerRatingKey(value);
      const tokens = key.split(" ").filter(Boolean);
      return tokens.length * 100 + key.length;
    };

    return [...App.transfers.getMarketSearchAliases(query)].sort(
      (left, right) =>
        scoreAlias(right) - scoreAlias(left) ||
        String(right || "").localeCompare(String(left || "")),
    );
  },

  getMarketPlayerSourcePriority(item = {}) {
    const source = App.utils.normalizeText(
      item.source || item.syntheticSource || "",
    );
    const marketValue = Number(item.market_value_eur || item.marketValue || 0);
    const hasTransfermarktUrl = Boolean(String(item.transfermarkt_url || "").trim());

    if (item.isRatingOnly || source.includes("ea_rating")) return 5;
    if (source.includes("transfermarkt_profile_sync")) return 100;
    if (source.includes("dcaribou_transfermarkt_datasets")) {
      return marketValue > 0 ? 70 : 40;
    }
    if (source.includes("transferencias_existentes")) {
      return hasTransfermarktUrl && marketValue > 0 ? 65 : 20;
    }
    if (hasTransfermarktUrl && marketValue > 0) return 65;
    if (marketValue > 0) return 50;
    return 10;
  },

  getMarketPositionQueryAliases(query = "") {
    const key = App.transfers.normalizePlayerRatingKey(query).replace(/\s+/g, " ");
    const compactKey = key.replace(/\s+/g, "");
    const aliases = {
      gk: ["gk", "goalkeeper", "keeper"],
      cb: ["cb", "centre back", "centre-back", "center back", "center-back"],
      lb: ["lb", "left back", "left-back"],
      rb: ["rb", "right back", "right-back"],
      lwb: ["lwb", "left wing back", "left wing-back", "left-wing-back"],
      rwb: ["rwb", "right wing back", "right wing-back", "right-wing-back"],
      cdm: ["cdm", "defensive midfield", "defensive midfielder"],
      cm: ["cm", "central midfield", "central midfielder", "midfield"],
      cam: ["cam", "attacking midfield", "attacking midfielder"],
      lm: ["lm", "left midfield", "left midfielder"],
      rm: ["rm", "right midfield", "right midfielder"],
      lw: ["lw", "left winger", "left wing"],
      rw: ["rw", "right winger", "right wing"],
      cf: ["cf", "centre forward", "centre-forward", "center forward", "center-forward"],
      st: ["st", "striker", "centre forward", "centre-forward", "center forward", "center-forward"],
    };
    return aliases[key] || aliases[compactKey] || [];
  },

  getMarketPositionSearchRelevance(query = "", position = "") {
    const positionKey = App.transfers.normalizePlayerRatingKey(position);
    if (!positionKey) return 0;
    const aliases = App.transfers.getMarketPositionQueryAliases(query);
    if (!aliases.length) return 0;
    const aliasKeys = aliases.map(App.transfers.normalizePlayerRatingKey);
    return aliasKeys.some(
      (aliasKey) =>
        aliasKey &&
        (positionKey === aliasKey ||
          positionKey.includes(aliasKey) ||
          aliasKey.includes(positionKey)),
    )
      ? 185
      : 0;
  },

  hasReliableMarketCoverage(query = "", players = []) {
    const aliasKeys = App.transfers
      .sortMarketSearchAliases(query)
      .map(App.transfers.normalizePlayerRatingKey);

    return (players || []).some((player) => {
      if (player.isRatingOnly) return false;
      if (App.transfers.getMarketPlayerSourcePriority(player) < 65) return false;
      const playerKey = App.transfers.normalizePlayerRatingKey(player.name || "");
      if (!playerKey) return false;
      return aliasKeys.some(
        (aliasKey) =>
          aliasKey &&
          App.transfers.isTrustedPlayerNameMatch(aliasKey, playerKey),
      );
    });
  },

  alignMarketPlayerCurrentClub(item = {}) {
    if (!item || item.isRatingOnly) return item;
    if (App.transfers.getMarketPlayerSourcePriority(item) >= 90) return item;

    const rating = App.transfers.findEaRatingForMarketPlayer(item);
    const publicRef = App.transfers.findPublicSalaryReference(
      item.name || item.player || "",
      item.club || item.fromClub || "",
    );
    const ratingClub = String(rating?.club || "").trim();
    const salaryClub = String(
      publicRef?.clubName || publicRef?.club_name || "",
    ).trim();
    const ratingClubKey = App.utils.normalizeText(ratingClub);
    const salaryClubKey = App.utils.normalizeText(salaryClub);
    const preferredClub =
      ratingClubKey && ratingClubKey === salaryClubKey
        ? ratingClub
        : ratingClub || salaryClub;

    if (!preferredClub) return item;
    if (
      App.utils.normalizeText(item.club || "") ===
      App.utils.normalizeText(preferredClub)
    ) {
      return item;
    }

    return {
      ...item,
      club: preferredClub,
    };
  },

  consolidateMarketSearchPlayers(query = "", players = []) {
    const groups = new Map();
    const buildConsolidationKey = (player = {}) => {
      const identityKey =
        (typeof App.api?.getMarketPlayerIdentityKey === "function" &&
          App.api.getMarketPlayerIdentityKey(player)) ||
        "";
      if (identityKey) return identityKey;

      const playerName = App.transfers.normalizePlayerRatingKey(
        player.name || player.player || "",
      );
      const playerClub = App.transfers.normalizePlayerRatingKey(
        player.original_club || player.club || "",
      );
      return [playerName, playerClub].filter(Boolean).join("|") || "";
    };
    const getClubKeys = (player = {}) =>
      [
        player.club,
        player.original_club,
        player.originalClub,
        player.fromClub,
        player.ClubeOrigem,
      ]
        .map((value) => App.transfers.normalizePlayerRatingKey(value || ""))
        .filter(Boolean);
    const hasClubOverlap = (left = {}, right = {}) => {
      const leftClubs = getClubKeys(left);
      const rightClubs = getClubKeys(right);
      if (!leftClubs.length || !rightClubs.length) return false;
      return leftClubs.some((clubKey) => rightClubs.includes(clubKey));
    };
    const isRatingDuplicateOfReal = (ratingOnly = {}, real = {}) =>
      Boolean(
        ratingOnly?.isRatingOnly &&
          real &&
          !real.isRatingOnly &&
          App.transfers.getMarketPlayerSourcePriority(real) >= 50 &&
          App.transfers.isMarketPlayerNameVariantMatch(
            ratingOnly.name || "",
            real.name || "",
          ) &&
          hasClubOverlap(ratingOnly, real),
      );

    [...(players || [])].forEach((player) => {
      const key = buildConsolidationKey(player);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(player);
    });

    const preferred = [];
    groups.forEach((group) => {
      const realRows = group.filter((item) => !item.isRatingOnly);
      if (!realRows.length) {
        preferred.push(...group);
        return;
      }

      const bestReal =
        [...realRows].sort(
          (left, right) =>
            App.transfers.getMarketPlayerSourcePriority(right) -
              App.transfers.getMarketPlayerSourcePriority(left) ||
            Number(right.market_value_eur || right.marketValue || 0) -
              Number(left.market_value_eur || left.marketValue || 0) ||
            String(right.transfermarkt_url || "").length -
              String(left.transfermarkt_url || "").length ||
            String(left.club || "").localeCompare(String(right.club || "")),
        )[0] || realRows[0];

      preferred.push(App.transfers.alignMarketPlayerCurrentClub(bestReal));
    });

    const realPreferred = preferred.filter((item) => !item.isRatingOnly);
    const deduped = preferred.filter(
      (item) =>
        !item.isRatingOnly ||
        !realPreferred.some((real) => isRatingDuplicateOfReal(item, real)),
    );

    return App.transfers.rankMarketSearchPlayers(query, deduped);
  },

  getMarketSearchRelevance(query = "", player = {}) {
    const normalizedQuery = App.transfers.normalizePlayerRatingKey(query);
    if (!normalizedQuery) return 0;

    const aliasKeys = App.transfers
      .getMarketSearchAliases(query)
      .map(App.transfers.normalizePlayerRatingKey);
    const clubAliasKeys = App.transfers
      .getMarketClubSearchAliases(query)
      .map(App.transfers.normalizePlayerRatingKey)
      .filter(Boolean);
    const hasExpandedAlias = aliasKeys.some(
      (aliasKey) => aliasKey && aliasKey !== normalizedQuery,
    );
    const nameKey = App.transfers.normalizePlayerRatingKey(player.name || "");
    const clubKey = App.transfers.normalizePlayerRatingKey(player.club || "");
    const originalClubKey = App.transfers.normalizePlayerRatingKey(
      player.original_club || player.originalClub || "",
    );
    const leagueKey = App.transfers.normalizePlayerRatingKey(player.league || "");
    const countryKey = App.transfers.normalizePlayerRatingKey(
      player.country || "",
    );
    const positionKey = App.transfers.normalizePlayerRatingKey(
      player.position || "",
    );
    const nameTokens = nameKey.split(" ").filter(Boolean);
    const clubTokens = clubKey.split(" ").filter(Boolean);
    const originalClubTokens = originalClubKey.split(" ").filter(Boolean);
    const leagueTokens = leagueKey.split(" ").filter(Boolean);
    const countryTokens = countryKey.split(" ").filter(Boolean);
    const positionTokens = positionKey.split(" ").filter(Boolean);
    const allTokens = [
      ...nameTokens,
      ...clubTokens,
      ...originalClubTokens,
      ...leagueTokens,
      ...countryTokens,
      ...positionTokens,
    ];
    const clubFieldKeys = [clubKey, originalClubKey].filter(Boolean);
    const clubSearchKeys = [...new Set([normalizedQuery, ...clubAliasKeys])];
    const positionAliasScore = !hasExpandedAlias
      ? App.transfers.getMarketPositionSearchRelevance(
          normalizedQuery,
          positionKey,
        )
      : 0;

    if (aliasKeys.includes(nameKey)) return 220;
    if (aliasKeys.some((aliasKey) => nameTokens.includes(aliasKey))) return 200;
    if (nameTokens.includes(normalizedQuery)) return 190;
    if (positionAliasScore) return positionAliasScore;
    if (!hasExpandedAlias && positionTokens.includes(normalizedQuery))
      return 185;
    if (
      aliasKeys.some((aliasKey) =>
        App.transfers.isTrustedPlayerNameMatch(aliasKey, nameKey),
      )
    ) {
      return 180;
    }
    if (nameKey.startsWith(`${normalizedQuery} `) || nameKey === normalizedQuery)
      return 170;
    if (
      !hasExpandedAlias &&
      nameTokens.some((token) => token.startsWith(normalizedQuery))
    )
      return 160;
    if (
      clubAliasKeys.length &&
      clubSearchKeys.some((searchKey) =>
        clubFieldKeys.some(
          (fieldKey) =>
            fieldKey === searchKey ||
            fieldKey.includes(searchKey) ||
            searchKey.includes(fieldKey),
        ),
      )
    ) {
      return 145;
    }
    if (!hasExpandedAlias && clubTokens.includes(normalizedQuery)) return 130;
    if (!hasExpandedAlias && originalClubTokens.includes(normalizedQuery))
      return 130;
    if (
      !hasExpandedAlias &&
      [...clubTokens, ...originalClubTokens].some((token) =>
        token.startsWith(normalizedQuery),
      )
    )
      return 120;
    if (!hasExpandedAlias && leagueTokens.includes(normalizedQuery)) return 110;
    if (
      !hasExpandedAlias &&
      leagueTokens.some((token) => token.startsWith(normalizedQuery))
    )
      return 100;
    if (
      !hasExpandedAlias &&
      positionTokens.some((token) => token.startsWith(normalizedQuery))
    )
      return 115;
    if (!hasExpandedAlias && countryTokens.includes(normalizedQuery))
      return 105;
    if (
      !hasExpandedAlias &&
      countryTokens.some((token) => token.startsWith(normalizedQuery))
    )
      return 95;
    if (
      !hasExpandedAlias &&
      normalizedQuery.length <= 3 &&
      allTokens.some((token) => token.includes(normalizedQuery))
    )
      return 60;
    return 0;
  },

  rankMarketSearchPlayers(query = "", players = []) {
    return [...(players || [])]
      .map((player) => ({
        player,
        score: App.transfers.getMarketSearchRelevance(query, player),
      }))
      .filter((entry) => entry.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          Number(b.player.market_value_eur || b.player.marketValue || 0) -
            Number(a.player.market_value_eur || a.player.marketValue || 0) ||
          String(a.player.name || "").localeCompare(String(b.player.name || "")),
      )
      .map((entry) => entry.player);
  },

  buildSyntheticMarketPlayersFromRatings(query = "", ratings = [], limit = 8) {
    const normalizedQuery = App.transfers.normalizePlayerRatingKey(query);
    const prepared = [...(ratings || [])]
      .filter(App.transfers.isPlayableRating)
      .map(
        (player) =>
          App.transfers.applyManualRatingFallback(player, query) || player,
      )
      .sort(
        (a, b) =>
          App.transfers.getRatingSourcePriority(b) -
            App.transfers.getRatingSourcePriority(a) ||
          Number(b.overall || 0) - Number(a.overall || 0) ||
          String(a.name || "").localeCompare(String(b.name || "")),
      );

    const byIdentity = new Map();
    prepared.forEach((rating) => {
      const safeName = App.transfers.sanitizePlayerSearchText(rating.name || "");
      const player = {
        id:
          rating.id ||
          rating.ea_id ||
          `ea-rating:${App.transfers.normalizePlayerRatingKey(safeName)}|${App.utils.normalizeText(rating.club || "")}`,
        syntheticSource: "ea_rating",
        isRatingOnly: true,
        name: safeName,
        normalized_name: App.utils.normalizeText(safeName),
        club: rating.club || "",
        original_club: rating.club || "",
        league: rating.league || "",
        country: rating.nation || rating.country || "",
        position: rating.position || "",
        age: Number(rating.age || 0),
        overall: Number(rating.overall || 0),
        market_value_eur: 0,
        marketValueSource: "ea_rating_only",
        avatar_url: rating.avatar_url || "",
        shield_url: rating.shield_url || "",
        source_name: rating.source_name || "",
        source_url: rating.source_url || "",
      };
      const key = App.api.getMarketPlayerIdentityKey(player);
      if (!key || byIdentity.has(key)) return;
      if (
        normalizedQuery &&
        App.transfers.getMarketSearchRelevance(query, player) <= 0
      ) {
        return;
      }
      byIdentity.set(key, player);
    });

    return [...byIdentity.values()].slice(0, Math.max(1, Number(limit || 8)));
  },

  getMarketSearchShowContracted(options = {}) {
    const searchOptions = options || {};
    if (Object.prototype.hasOwnProperty.call(searchOptions, "showContracted")) {
      return Boolean(searchOptions.showContracted);
    }
    return Boolean(document.getElementById("showContractedPlayers")?.checked);
  },

  async searchMarketPlayers(query = "", options = {}) {
    const searchOptions = options || {};
    const showContracted =
      App.transfers.getMarketSearchShowContracted(searchOptions);
    const normalized = App.utils.normalizeText(query);
    if (normalized.length < 2) return [];
    const resultLimit = Math.max(
      1,
      Math.min(Number(searchOptions.limit || 18), 80),
    );
    const cacheKey = `rating-visible-v1|${normalized}|${showContracted ? "all" : "available"}|${resultLimit}`;
    const onProgress =
      typeof searchOptions.onProgress === "function"
        ? searchOptions.onProgress
        : null;
    const cached = App.transfers.marketSearchCache?.[cacheKey];
    if (cached && Date.now() - cached.at < 60000) {
      const players = App.api?.applyMarketPlayerOverrides
        ? App.api.applyMarketPlayerOverrides(cached.players, {
            showContracted,
          })
        : cached.players;
      cached.players = players;
      if (onProgress) {
        try {
          onProgress(players, { source: "cache" });
        } catch (error) {
          console.warn("Progresso da busca de mercado indisponivel:", error);
        }
      }
      return players;
    }
    const pending = App.transfers.marketSearchPending?.[cacheKey];
    if (pending) {
      if (onProgress) {
        pending
          .then((players) => onProgress(players, { source: "pending" }))
          .catch(() => {});
      }
      return pending;
    }

    const remember = (players = []) => {
      const normalizedPlayers = App.api?.applyMarketPlayerOverrides
        ? App.api.applyMarketPlayerOverrides(players, {
            showContracted,
          })
        : players;
      App.transfers.marketSearchCache = App.transfers.marketSearchCache || {};
      App.transfers.marketSearchCache[cacheKey] = {
        at: Date.now(),
        players: normalizedPlayers,
      };
      return normalizedPlayers;
    };

    App.transfers.marketSearchPending = App.transfers.marketSearchPending || {};
    const request = (async () => {
      const aliases = App.transfers.sortMarketSearchAliases(query);
      const primaryAlias = aliases[0] || query;
      const primaryAliasTokens = App.transfers
        .normalizePlayerRatingKey(primaryAlias)
        .split(" ")
        .filter(Boolean);
      const isSpecificNameSearch =
        primaryAliasTokens.length >= 2 &&
        !App.transfers.getMarketPositionQueryAliases(primaryAlias).length;
      const renderKey = `${normalized}|${showContracted ? "all" : "available"}`;
      const applyOverrides = (rows = []) =>
        App.api.applyMarketPlayerOverrides(rows, { showContracted });
      const publishProgress = (rows = [], source = "market") => {
        const ranked = App.transfers
          .consolidateMarketSearchPlayers(query, applyOverrides(rows))
          .slice(0, resultLimit);
        if (!ranked.length) return [];
        App.api.mergeMarketPlayers(ranked);
        if (onProgress) {
          try {
            onProgress(ranked, { source });
          } catch (error) {
            console.warn("Progresso da busca de mercado indisponivel:", error);
          }
        }
        return ranked;
      };
      const refreshFromRows = (rows = []) => {
        if (!rows.length) return;
        const freshRanked = App.transfers
          .consolidateMarketSearchPlayers(
            query,
            App.api.applyMarketPlayerOverrides(rows, { showContracted }),
          )
          .slice(0, resultLimit);
        if (!freshRanked.length) return;
        remember(freshRanked);
        App.api.mergeMarketPlayers(freshRanked);
        App.react?.notify?.();
        const target = document.getElementById("marketPlayerResults");
        const legacyInput = document.getElementById("marketPlayerSearch");
        if (
          target?.dataset.marketRenderKey === renderKey &&
          App.utils.normalizeText(legacyInput?.value || "") === normalized
        ) {
          target.dataset.marketRenderReady = "false";
          App.transfers.renderMarketPlayerResults();
        }
      };
      const scheduleFullMarketRefresh = () => {
        if (App.api?.isRateLimitedMarketQuery?.()) return;
        const runRefresh = () => {
          App.api
            .loadMarketPlayers(primaryAlias, showContracted, resultLimit, {
              rpcTimeoutMs: 3800,
              directTimeoutMs: 2600,
            })
            .then((rows) =>
              App.transfers.hydrateMarketSearchRowsWithTransfermarkt(
                rows,
                isSpecificNameSearch,
              ),
            )
            .then(refreshFromRows)
            .catch(() => {});
        };
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(runRefresh, { timeout: 1800 });
        } else {
          window.setTimeout(runRefresh, 750);
        }
      };
      const scheduleDelay = (delayMs = 0) =>
        new Promise((resolve) => {
          const timer =
            typeof window !== "undefined" && window.setTimeout
              ? window.setTimeout
              : setTimeout;
          timer(resolve, Math.max(0, Number(delayMs || 0)));
        });
      const fallbackSourceDelayMs = Math.max(
        0,
        Number(
          searchOptions.fallbackSourceDelayMs ??
            (isSpecificNameSearch ? 3600 : 1200),
        ),
      );
      const ratingSourceDelayMs = Math.max(
        0,
        Number(
          searchOptions.ratingSourceDelayMs ??
            (isSpecificNameSearch ? 700 : 1800),
        ),
      );
      const directRowsPromise = App.api
        .fetchMarketPlayersDirect(primaryAlias, resultLimit, {
          timeoutMs: Number(searchOptions.directTimeoutMs || 4200),
        })
        .then((rows) =>
          App.transfers.hydrateMarketSearchRowsWithTransfermarkt(
            rows,
            isSpecificNameSearch,
          ),
        )
        .then((rows) => publishProgress(rows, "direct"))
        .catch(() => []);
      const fallbackRowsPromise = scheduleDelay(fallbackSourceDelayMs)
        .then(() =>
          App.api.searchRegionalFallbackPlayers(primaryAlias, resultLimit, {
            showContracted,
          }),
        )
        .then((rows) =>
          App.transfers.hydrateMarketSearchRowsWithTransfermarkt(
            rows,
            isSpecificNameSearch,
          ),
        )
        .then((rows) => publishProgress(rows, "fallback"))
        .catch(() => []);
      const ratingFallbackRowsPromise =
        searchOptions.includeRatingFallback === false
          ? Promise.resolve([])
          : scheduleDelay(ratingSourceDelayMs)
              .then(() =>
                App.transfers.searchEaRatingsCached(
                  primaryAlias,
                  Math.min(resultLimit, 8),
                ),
              )
              .then((ratings) =>
                App.transfers.buildSyntheticMarketPlayersFromRatings(
                  query,
                  ratings,
                  resultLimit,
                ),
              )
              .then((rows) =>
                App.transfers.hydrateRatingOnlyMarketPlayersWithTransfermarkt(
                  rows,
                ),
              )
              .catch(() => []);
      const requireRows = (source) =>
        source.then((rows) => {
          if (rows.length) return rows;
          throw new Error("empty-market-source");
        });
      const isRatingOnlyResultSet = (rows = []) =>
        rows.length > 0 &&
        rows.every((item) => App.transfers.isRatingOnlyMarketPlayer(item));
      const waitForMarketSource = () =>
        new Promise((resolve) => {
          const timeout = Math.max(
            0,
            Number(
              searchOptions.marketSourceGraceMs ??
                (isSpecificNameSearch ? 1500 : 260),
            ),
          );
          const timer =
            typeof window !== "undefined" && window.setTimeout
              ? window.setTimeout
              : setTimeout;
          timer(() => resolve([]), timeout);
        });
      const waitForPreferredMarketRows = (timeoutMs = 0) =>
        Promise.race([
          preferredMarketRowsPromise,
          scheduleDelay(timeoutMs).then(() => []),
        ]).catch(() => []);
      let preferredMarketSettled = false;
      const preferredMarketRowsPromise = Promise.any(
        [directRowsPromise, fallbackRowsPromise].map(requireRows),
      )
        .catch(() => [])
        .finally(() => {
          preferredMarketSettled = true;
        });
      const preferredMarketRows = await Promise.race([
        preferredMarketRowsPromise,
        waitForMarketSource(),
      ]);
      const ratingMarketGraceMs = Math.max(
        0,
        Number(searchOptions.ratingMarketGraceMs ?? 2600),
      );
      const mergeWithPreferredMarketRows = async (rows = []) => {
        if (!isRatingOnlyResultSet(rows)) return rows;
        const marketRows = await waitForPreferredMarketRows(
          preferredMarketSettled ? 0 : ratingMarketGraceMs,
        );
        return marketRows.length
          ? App.api.mergeMarketSearchRows(marketRows, rows, resultLimit)
          : rows;
      };
      const ratingFallbackPromise = ratingFallbackRowsPromise
        .then(mergeWithPreferredMarketRows)
        .then((rows) => publishProgress(rows, "rating"));
      let firstRows = preferredMarketRows.length
        ? preferredMarketRows
        : await Promise.any([
            preferredMarketRowsPromise.then((rows) => {
              if (rows.length) return rows;
              throw new Error("empty-market-source");
            }),
            requireRows(ratingFallbackPromise),
          ]).catch(() => []);
      firstRows = await mergeWithPreferredMarketRows(firstRows);
      scheduleFullMarketRefresh();
      const groups = firstRows.length
        ? firstRows
        : await Promise.all([
            directRowsPromise,
            fallbackRowsPromise,
            ratingFallbackPromise,
          ]).then(([directRows, fallbackRows, ratingRows]) =>
            App.api.mergeMarketSearchRows(
              App.api.mergeMarketSearchRows(
                directRows,
                fallbackRows,
                resultLimit,
              ),
              ratingRows,
              resultLimit,
            ),
          );
      const hydratedGroups =
        await App.transfers.hydrateMarketSearchRowsWithTransfermarkt(
          groups,
          isSpecificNameSearch,
        );
      let ranked = App.transfers.consolidateMarketSearchPlayers(
        query,
        App.api.applyMarketPlayerOverrides(hydratedGroups, { showContracted }),
      );

      if (
        aliases.length > 1 &&
        aliases[0].length >= 5 &&
        normalized.length >= 5 &&
        !App.transfers.hasReliableMarketCoverage(query, ranked) &&
        !App.api?.isRateLimitedMarketQuery?.()
      ) {
        const secondaryGroups = await Promise.all(
          aliases.slice(1, 3).map((alias) =>
            Promise.any(
              [
                App.api.fetchMarketPlayersDirect(
                  alias,
                  Math.min(resultLimit, 18),
                  {
                    timeoutMs: 2200,
                  },
                ),
                App.api.searchRegionalFallbackPlayers(
                  alias,
                  Math.min(resultLimit, 18),
                  {
                    showContracted,
                  },
                ),
              ].map((source) =>
                source.then((rows) => {
                  if (rows.length) return rows;
                  throw new Error("empty-market-source");
                }),
              ),
            )
              .catch(() => [])
              .then((rows) =>
                App.transfers.hydrateMarketSearchRowsWithTransfermarkt(
                  rows,
                  isSpecificNameSearch,
                ),
              ),
          ),
        );
        ranked = App.transfers.consolidateMarketSearchPlayers(
          query,
          App.api.applyMarketPlayerOverrides(
            [...hydratedGroups, ...secondaryGroups.flat()],
            { showContracted },
          ),
        );
      }

      if (ranked.length) {
        App.api.mergeMarketPlayers(ranked);
      }
      return remember(ranked.slice(0, resultLimit));
    })().finally(() => {
      delete App.transfers.marketSearchPending?.[cacheKey];
    });

    App.transfers.marketSearchPending[cacheKey] = request;
    return request;
  },

  queueMarketResultRatingHydration(players = [], renderKey = "", requestId = "") {
    if (!players.length || !App.api?.loadRatingsForPlayerNames) return;

    const names = [
      ...new Set(
        players
          .map((player) => String(player?.name || "").trim())
          .filter(Boolean),
      ),
    ]
      .filter((name) => !App.transfers.getRatingForPlayerName(name)?.overall)
      .slice(0, App.api?.isRateLimitedRatingsQuery?.() ? 5 : 8);
    if (!names.length) return;

    const hydrationKey = `${renderKey}|${names
      .map((name) => App.transfers.normalizePlayerRatingKey(name))
      .sort()
      .join("|")}`;
    App.transfers.marketRatingHydrationKeys =
      App.transfers.marketRatingHydrationKeys || new Set();
    if (App.transfers.marketRatingHydrationKeys.has(hydrationKey)) return;
    App.transfers.marketRatingHydrationKeys.add(hydrationKey);

    App.api
      .loadRatingsForPlayerNames(names, 2, App.api?.isRateLimitedRatingsQuery?.() ? 5 : 8)
      .then(() => {
        if (App.transfers.marketSearchRequestId !== requestId) return;
        const target = document.getElementById("marketPlayerResults");
        if (!target || target.dataset.marketRenderKey !== renderKey) return;
        target.dataset.marketRenderReady = "false";
        App.transfers.renderMarketPlayerResults();
      })
      .catch((error) =>
        console.warn("Hidratacao de ratings do mercado indisponivel:", error),
      );
  },

  async searchEaRatingsCached(query = "", limit = 2) {
    const normalized = App.utils.normalizeText(query);
    if (!normalized) return [];
    if (App.api?.isRateLimitedRatingsQuery?.()) return [];

    const cacheKey = `${normalized}|${Number(limit || 2)}`;
    const cached = App.transfers.eaRatingSearchCache?.[cacheKey];
    if (cached && Date.now() - cached.at < 10 * 60000) return cached.rows;
    const localMatch = App.transfers.findEaRatingForMarketPlayer({
      name: query,
    });
    if (localMatch) return [localMatch];
    const pending = App.transfers.eaRatingSearchPending?.[cacheKey];
    if (pending) return pending;

    App.transfers.eaRatingSearchCache = App.transfers.eaRatingSearchCache || {};
    App.transfers.eaRatingSearchPending =
      App.transfers.eaRatingSearchPending || {};
    const request = App.api
      .searchEaRatings(query, limit)
      .catch(() => [])
      .then((rows) => {
        App.api.mergeEaRatings?.(rows);
        App.transfers.eaRatingSearchCache[cacheKey] = {
          at: Date.now(),
          rows,
        };
        return rows;
      })
      .finally(() => {
        delete App.transfers.eaRatingSearchPending?.[cacheKey];
      });

    App.transfers.eaRatingSearchPending[cacheKey] = request;
    return request;
  },

  selectMarketPlayer(playerOrId) {
    const form = document.getElementById("transferForm");
    if (!form) return;

    const player =
      playerOrId && typeof playerOrId === "object"
        ? playerOrId
        : App.transfers
            .getMarketPlayers()
            .find((item) => String(item.id) === String(playerOrId));
    if (!player || App.transfers.isMarketPlayerContracted(player)) return;

    if (form.elements.player) form.elements.player.value = player.name || "";
    if (form.elements.fromClub)
      form.elements.fromClub.value = player.club || "";
    const marketValue = Math.round(App.transfers.getMarketPlayerValue(player));
    if (form.elements.marketValue) {
      form.elements.marketValue.value = marketValue > 0 ? marketValue : "";
    }
    if (form.elements.offerValue) {
      App.transfers.setTransferOfferInputValue(form, marketValue > 0 ? marketValue : 0);
    }
    const overall = App.transfers.getResolvedOverall({
      ...player,
      marketValue,
    });
    App.transfers.applyOverallToForm(form, overall);
    App.transfers.clearSalaryReferenceFromForm(form);
    App.transfers.setSelectedTransferContext(form, {
      ...player,
      player: player.name || "",
      name: player.name || "",
      fromClub: player.club || "",
      club: player.club || "",
      overall,
      marketValue,
    });

    const salaryReference = App.transfers.getSalaryReferenceFromItem({
      ...player,
      overall,
      marketValue,
    });
    App.transfers.applySalaryReferenceToForm(form, salaryReference);

    const search = document.getElementById("marketPlayerSearch");
    if (search) search.value = `${player.name} • ${player.club}`;

    App.transfers.renderTransferPreview(form);
    App.transfers.refreshSalaryQuoteForForm(form, {
      ...player,
      overall,
      marketValue,
    });
  },

  async renderEaRatingResults(query = "") {
    const target = document.getElementById("eaRatingResults");
    if (!target) return;

    if (!query) {
      App.dom.setHtml(
        target,
        `<div class="market-empty">Digite o nome do jogador para conferir overall, posição, clube e foto na base importada.</div>`,
      );
      return;
    }

    const ratingGroups = await Promise.all(
      App.transfers.getPlayerSearchAliases(query).map((alias) =>
        App.transfers.searchEaRatingsCached(alias, 8).catch((error) => {
          console.warn("Busca de rating indisponível:", error);
          return [];
        }),
      ),
    );
    const ratingsRaw = ratingGroups.flat();
    const ratings = ratingsRaw
      .filter(App.transfers.isPlayableRating)
      .map(
        (player) =>
          App.transfers.applyManualRatingFallback(player, query) || player,
      )
      .sort(
        (a, b) =>
          App.transfers.getRatingSourcePriority(b) -
            App.transfers.getRatingSourcePriority(a) ||
          Number(b.overall || 0) - Number(a.overall || 0) ||
          String(a.name || "").localeCompare(String(b.name || "")),
      );
    const manualRating = App.transfers.getManualPlayerRating(query);
    if (
      manualRating &&
      !ratings.some(
        (player) =>
          App.transfers.normalizePlayerRatingKey(player.name) ===
          App.transfers.normalizePlayerRatingKey(manualRating.name),
      )
    ) {
      ratings.unshift(manualRating);
    }

    App.api.mergeEaRatings?.(ratings);

    if (!ratings.length) {
      const marketMatches = await App.api
        .loadMarketPlayers(query, true, 3)
        .catch(() => []);
      App.dom.setHtml(
        target,
        `
        <div class="market-empty">
          Nenhum overall/foto importado para "${App.utils.escapeHtml(query)}".
          ${marketMatches.length ? "O jogador existe no mercado, mas ainda precisa entrar na base de ratings." : "Tente nome completo ou confira se ele existe no mercado."}
        </div>
      `,
      );
      return;
    }

    App.dom.setHtml(
      target,
      ratings
        .map(
          (player) => `
      <button class="ea-rating-option" type="button" data-ea-rating="${App.utils.escapeHtml(player.id || player.ea_id || player.name)}">
        ${App.transfers.renderPlayerPhoto(player, null, "ea-rating-photo")}
        <span>
          <strong>${App.utils.escapeHtml(player.name || "-")}</strong>
          <small>${App.utils.escapeHtml([player.position, player.club, player.nation, App.transfers.getRatingSourceLabel(player)].filter(Boolean).join(" · "))}</small>
        </span>
        <b>OVR ${Number(player.overall || 0)}</b>
      </button>
    `,
        )
        .join(""),
    );

    target.querySelectorAll("[data-ea-rating]").forEach((button) => {
      button.addEventListener("click", () => {
        const selected = ratings.find(
          (item) =>
            String(item.id || item.ea_id || item.name) ===
            String(button.dataset.eaRating),
        );
        const form = document.getElementById("transferForm");
        if (!selected || !form) return;
        if (form.elements.player)
          form.elements.player.value = selected.name || "";
        if (form.elements.fromClub)
          form.elements.fromClub.value = selected.club || "";
        const marketValue = Number(form.elements.marketValue?.value || 0);
        const overall = App.transfers.getResolvedOverall({
          ...selected,
          marketValue,
        });
        App.transfers.applyOverallToForm(form, overall);
        App.transfers.clearSalaryReferenceFromForm(form);
        App.transfers.setSelectedTransferContext(form, {
          ...selected,
          player: selected.name || "",
          name: selected.name || "",
          fromClub: selected.club || "",
          club: selected.club || "",
          overall,
          marketValue,
        });
        const salaryReference = App.transfers.getSalaryReferenceFromItem({
          ...selected,
          overall,
          marketValue,
        });
        App.transfers.applySalaryReferenceToForm(form, salaryReference);
        App.transfers.renderTransferPreview(form);
        App.transfers.refreshSalaryQuoteForForm(form, {
          ...selected,
          overall,
          marketValue,
        });
      });
    });
  },

  async renderMarketPlayerResults() {
    const target = document.getElementById("marketPlayerResults");
    const input = document.getElementById("marketPlayerSearch");
    if (!target) return;

    const query = input?.value || "";
    const normalized = App.utils.normalizeText(query);
    if (normalized.length < 2) {
      App.transfers.marketSearchRequestId = "";
      target.dataset.marketRenderKey = `empty:${normalized}`;
      target.dataset.marketRenderReady = "true";
      App.dom.setHtml(
        target,
        `
        <div class="market-empty">
          Digite pelo menos 2 letras para buscar jogadores no mercado.
        </div>
      `,
      );
      return;
    }

    const showContracted = Boolean(
      document.getElementById("showContractedPlayers")?.checked,
    );
    const renderKey = `${normalized}|${showContracted ? "all" : "available"}`;
    if (
      target.dataset.marketRenderKey === renderKey &&
      target.dataset.marketRenderReady === "true"
    ) {
      return;
    }

    const activeRender = App.transfers.marketResultsPending;
    if (activeRender?.key === renderKey) return activeRender.promise;

    const requestId = `${Date.now()}-${Math.random()}`;
    App.transfers.marketSearchRequestId = requestId;
    target.dataset.marketRenderKey = renderKey;
    target.dataset.marketRenderReady = "false";
    target.setAttribute("aria-busy", "true");
    App.dom.setHtml(
      target,
      App.ui?.loadingState
        ? App.ui.loadingState(
            "Buscando jogadores",
            "Consultando mercado, salarios e disponibilidade.",
            { className: "market-player-skeleton", skeleton: 4 },
          )
        : `
          <div class="app-loading-state market-player-skeleton" role="status" aria-live="polite" aria-busy="true">
            <span class="app-loading-spinner" aria-hidden="true"></span>
            <span class="app-loading-copy">
              <strong>Buscando jogadores</strong>
              <small>Consultando mercado, salarios e disponibilidade.</small>
            </span>
          </div>
        `,
    );

    const renderRequest = (async () => {
      const players = await App.transfers.searchMarketPlayers(query, {
        showContracted,
      });
      if (App.transfers.marketSearchRequestId !== requestId) return;

      if (!players.length) {
        App.dom.setHtml(
          target,
          `
        <div class="market-empty">
          Nenhum jogador disponível encontrado. Tente buscar por nome, clube, liga ou posição.
          ${document.getElementById("showContractedPlayers")?.checked ? "" : " Jogadores já contratados estão escondidos por padrão."}
        </div>
      `,
        );
        target.dataset.marketRenderReady = "true";
        target.setAttribute("aria-busy", "false");
        return;
      }

      App.dom.setHtml(
        target,
        players
          .map((player) => {
            const isContracted = App.transfers.isMarketPlayerContracted(player);
            const eaRating = App.transfers.findEaRatingForMarketPlayer(player);
            const marketValue = App.transfers.getMarketPlayerValue(player);
            const overall = App.transfers.getResolvedOverall({
              ...player,
              marketValue,
            });
            const salaryReference = App.transfers.getSalaryReferenceFromItem({
              ...player,
              overall,
              marketValue,
            });
            return `
        <button class="market-player-option ${isContracted ? "is-contracted" : ""}" type="button" data-market-player="${player.id}" ${isContracted ? "disabled" : ""}>
          ${App.transfers.renderPlayerPhoto(player, eaRating)}
          <span class="market-player-main">
            <strong>${App.transfers.renderMarketPlayerName(player.name || "-", query)}</strong>
            <small>${App.utils.escapeHtml([player.position, player.age ? `${player.age} anos` : "", player.league, player.club].filter(Boolean).join(" · "))}</small>
          </span>
          <span class="market-player-side">
            ${overall ? `<span class="market-player-overall">OVR ${overall}</span>` : ""}
            <span class="market-player-value">${App.utils.escapeHtml(App.transfers.formatMarketPlayerValueDisplay(player))}</span>
            ${
              salaryReference.ok
                ? `<span class="market-player-status">${App.utils.escapeHtml(App.transfers.getSalaryReferenceLabel(salaryReference))} ${App.utils.formatCurrency(salaryReference.weeklySalary)}/sem</span>`
                : ""
            }
            ${isContracted ? `<span class="market-player-status">Já contratado</span>` : ""}
          </span>
        </button>
      `;
          })
          .join(""),
      );

      const playerById = new Map(
        players.map((player) => [String(player.id), player]),
      );
      target.querySelectorAll("[data-market-player]").forEach((button) => {
        button.addEventListener("click", () =>
          App.transfers.selectMarketPlayer(
            playerById.get(String(button.dataset.marketPlayer)) ||
              button.dataset.marketPlayer,
          ),
        );
      });
      target.dataset.marketRenderReady = "true";
      target.setAttribute("aria-busy", "false");
      App.transfers.queueMarketResultRatingHydration(
        players,
        renderKey,
        requestId,
      );
    })().finally(() => {
      if (App.transfers.marketResultsPending?.key === renderKey) {
        App.transfers.marketResultsPending = null;
        target.setAttribute("aria-busy", "false");
      }
    });

    App.transfers.marketResultsPending = {
      key: renderKey,
      promise: renderRequest,
    };
    return renderRequest;
  },

  renderSummary() {
    App.react?.notify?.();
  },

  renderHistoryGrid() {
    const table = document.getElementById("transferTable");
    const mobile = document.getElementById("transferMobile");
    if (!table || !mobile) return;

    const data = App.transfers.getFilteredTransfers(5);
    if (!data.length) {
      App.dom.setHtml(
        table,
        App.ui.emptyCard(
          "Nenhuma transferência aprovada",
          "As movimentações confirmadas aparecem aqui assim que a liga concluir a assinatura.",
          "calendar-card transfer-history-empty",
        ),
      );
      App.dom.setHtml(
        mobile,
        App.ui.emptyCard(
          "Nenhuma transferência cadastrada",
          "Use o formulário Registrar transferência nesta aba.",
        ),
      );
      return;
    }

    App.dom.setHtml(
      table,
      data
        .map((item) => {
          const statusClass = App.transfers.getTransferStatusClass(item);
          const isCpuSale = App.transfers.isCpuSaleTransfer(item);
          const ownerLabel = isCpuSale
            ? item.seller || item.originalBuyer || "Técnico"
            : item.buyer;
          const destinationLabel = isCpuSale
            ? App.transfers.getCpuSaleDestination(item)
            : item.buyer;
          const originLabel = isCpuSale ? ownerLabel : item.fromClub || "-";
          return `
        <article class="transfer-history-row ours-row">
          <div class="transfer-history-cell transfer-history-player">${App.transfers.renderPlayerIdentity(
            item.player,
            "",
            "table-player-identity",
            {
              club: item.fromClub,
            },
          )}</div>
          <div class="transfer-history-cell transfer-history-destination">${App.ui.ownerBadge(destinationLabel, App.data.ownerColors["Livre / CPU"])}</div>
          <div class="transfer-history-cell transfer-history-origin">${App.utils.escapeHtml(originLabel)}</div>
          <div class="transfer-history-cell transfer-history-ovr numeric">${App.utils.escapeHtml(item.overall || "-")}</div>
          <div class="transfer-history-cell transfer-history-base">${App.utils.formatCurrency(item.marketValue)}</div>
          <div class="transfer-history-cell transfer-history-rate numeric">${Math.round(item.feeRate * 100)}%</div>
          <div class="transfer-history-cell transfer-history-value">${App.utils.formatCurrency(item.totalCost)}</div>
          <div class="transfer-history-cell transfer-history-status"><span class="transfer-status ${statusClass}">${App.transfers.getTransferStatusLabel(item)}</span></div>
        </article>
      `;
        })
        .join(""),
    );

    App.dom.setHtml(
      mobile,
      data
        .map((item) => {
          const isCpuSale = App.transfers.isCpuSaleTransfer(item);
          const ownerLabel = isCpuSale
            ? item.seller || item.originalBuyer || "Técnico"
            : item.buyer;
          const destinationLabel = isCpuSale
            ? App.transfers.getCpuSaleDestination(item)
            : item.buyer;
          return `
        <article class="calendar-card ours-row">
          <div class="calendar-card-header">${App.ui.ownerBadge(destinationLabel, App.data.ownerColors["Livre / CPU"])}<span class="transfer-status ${App.transfers.getTransferStatusClass(item)}">${App.transfers.getTransferStatusLabel(item)}</span></div>
          ${App.transfers.renderPlayerIdentity(
            item.player,
            `${isCpuSale ? `${ownerLabel} vendeu para ${destinationLabel}` : item.fromClub || "-"} · OVR ${item.overall}`,
            "mobile-player-identity",
            {
              club: item.fromClub,
            },
          )}
          <p>${isCpuSale ? "Valor recebido" : "Valor final"}: <strong>${App.utils.formatCurrency(item.totalCost)}</strong></p>
        </article>
      `;
        })
        .join(""),
    );
  },

  renderHistory() {
    if (document.getElementById("transferTable")?.classList.contains("transfer-history-grid-body")) {
      App.transfers.renderHistoryGrid();
      return;
    }
    const table = document.getElementById("transferTable");
    const mobile = document.getElementById("transferMobile");
    if (!table || !mobile) return;

    const data = App.transfers.getFilteredTransfers(5);
    if (!data.length) {
      App.dom.setHtml(
        table,
        `<tr><td colspan="8" class="calendar-muted">Nenhuma transferência aprovada ainda.</td></tr>`,
      );
      App.dom.setHtml(
        mobile,
        App.ui.emptyCard(
          "Nenhuma transferência cadastrada",
          "Use o formulário Registrar transferência nesta aba.",
        ),
      );
      return;
    }

    App.dom.setHtml(
      table,
      data
        .map((item) => {
          const statusClass = App.transfers.getTransferStatusClass(item);
          const isCpuSale = App.transfers.isCpuSaleTransfer(item);
          const ownerLabel = isCpuSale
            ? item.seller || item.originalBuyer || "Técnico"
            : item.buyer;
          const destinationLabel = isCpuSale
            ? App.transfers.getCpuSaleDestination(item)
            : item.buyer;
          const originLabel = isCpuSale ? ownerLabel : item.fromClub || "-";
          return `
        <tr class="ours-row">
          <td class="calendar-match">${App.transfers.renderPlayerIdentity(
            item.player,
            isCpuSale
              ? `${ownerLabel} vendeu para ${destinationLabel}`
              : item.fromClub || "-",
            "table-player-identity",
            {
              club: item.fromClub,
            },
          )}</td>
          <td>${App.ui.ownerBadge(destinationLabel, App.data.ownerColors["Livre / CPU"])}</td>
          <td>${App.utils.escapeHtml(originLabel)}</td>
          <td class="numeric">${item.overall}</td>
          <td>${App.utils.formatCurrency(item.marketValue)}</td>
          <td class="numeric">${Math.round(item.feeRate * 100)}%</td>
          <td>${App.utils.formatCurrency(item.totalCost)}</td>
          <td><span class="transfer-status ${statusClass}">${App.transfers.getTransferStatusLabel(item)}</span></td>
        </tr>
      `;
        })
        .join(""),
    );

    App.dom.setHtml(
      mobile,
      data
        .map((item) => {
          const isCpuSale = App.transfers.isCpuSaleTransfer(item);
          const ownerLabel = isCpuSale
            ? item.seller || item.originalBuyer || "Técnico"
            : item.buyer;
          const destinationLabel = isCpuSale
            ? App.transfers.getCpuSaleDestination(item)
            : item.buyer;
          return `
        <article class="calendar-card ours-row">
          <div class="calendar-card-header">${App.ui.ownerBadge(destinationLabel, App.data.ownerColors["Livre / CPU"])}<span class="transfer-status ${App.transfers.getTransferStatusClass(item)}">${App.transfers.getTransferStatusLabel(item)}</span></div>
          ${App.transfers.renderPlayerIdentity(
            item.player,
            `${isCpuSale ? `${ownerLabel} vendeu para ${destinationLabel}` : item.fromClub || "-"} · OVR ${item.overall}`,
            "mobile-player-identity",
            {
              club: item.fromClub,
            },
          )}
          <p>${isCpuSale ? "Valor recebido" : "Valor final"}: <strong>${App.utils.formatCurrency(item.totalCost)}</strong></p>
        </article>
      `;
        })
        .join(""),
    );
  },

  render() {
    App.react?.notify?.();
  },
};
