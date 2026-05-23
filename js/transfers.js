window.App = window.App || {};

App.transfers = {
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

  manualPlayerRatings: {
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
    "neymar": {
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
    "isco": {
      name: "Isco",
      club: "Real Betis",
      position: "CAM",
      nation: "Spain",
      overall: 84,
      gender: "Men's Football",
      avatar_url: "https://cdn.sofifa.net/players/197/781/26_240.png",
      source_url: "https://sofifa.com/player/197781/francisco-roman-alarcon-suarez",
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
    const normalized = App.utils.normalizeText(playerName);
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
      "nicolas pepe": ["Nicolas Pépé"],
      "nicolas pépé": ["Nicolas Pepe"],
    };

    return [playerName, ...(aliases[normalized] || [])].filter(Boolean);
  },

  normalizePlayerRatingKey(value) {
    return App.utils
      .normalizeText(value)
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  },

  getMarketPlayerValue(player) {
    const key = App.transfers.normalizePlayerRatingKey(player?.name);
    const override = App.transfers.manualMarketValues[key];
    if (override !== undefined) return Number(override);
    return Number(player?.market_value_eur || player?.marketValue || 0);
  },

  getTransferRate(overall) {
    if (overall >= 89) return 0.25;
    if (overall >= 84) return 0.15;
    if (overall >= 80) return 0.1;
    if (overall >= 75) return 0.05;
    return 0;
  },

  findEaRatingByName(playerName) {
    const key = App.transfers.normalizePlayerRatingKey(playerName);
    if (!key) return null;
    return (
      (App.state.apiRatings || []).find(
        (item) => App.transfers.normalizePlayerRatingKey(item.name) === key,
      ) || null
    );
  },

  findMarketPlayerByName(playerName) {
    const aliasKeys = App.transfers
      .getPlayerSearchAliases(playerName)
      .map(App.transfers.normalizePlayerRatingKey);
    const marketPlayers = Array.isArray(App.state.apiMarketPlayers)
      ? App.state.apiMarketPlayers
      : [];
    if (!aliasKeys.length || !marketPlayers.length) return null;

    return (
      marketPlayers.find((item) =>
        aliasKeys.includes(App.transfers.normalizePlayerRatingKey(item.name)),
      ) ||
      marketPlayers.find((item) => {
        const marketKey = App.transfers.normalizePlayerRatingKey(item.name);
        return aliasKeys.some(
          (aliasKey) =>
            marketKey.startsWith(`${aliasKey} `) ||
            aliasKey.startsWith(`${marketKey} `),
        );
      }) ||
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
      return (
        aliasKeys.includes(ratingKey) ||
        aliasKeys.some(
          (aliasKey) =>
            ratingKey.startsWith(`${aliasKey} `) ||
            aliasKey.startsWith(`${ratingKey} `),
        )
      );
    });
    const selected =
      matches.find(
        (item) =>
          App.transfers.normalizePlayerRatingKey(item.name) === key &&
          (!clubKey ||
            !item.club ||
            App.utils.normalizeText(item.club) === clubKey),
      ) ||
      matches.find((item) =>
        App.transfers.isUsablePlayerAvatar(item.avatar_url),
      ) ||
      matches[0] ||
      null;

    return App.transfers.applyManualRatingFallback(selected, player?.name);
  },

  getPlayerAvatarCandidates(player, rating = null) {
    const manual = App.transfers.getManualPlayerRating(player?.name || rating?.name);
    const candidates = [
      rating?.avatar_url,
      manual?.avatar_url,
      player?.avatar_url,
      App.transfers.getMarketPlayerAvatar(player),
    ]
      .filter(App.transfers.isUsablePlayerAvatar)
      .map((url) => String(url).trim());

    return [...new Set(candidates)];
  },

  handlePlayerPhotoError(image) {
    const candidates = (() => {
      try {
        return JSON.parse(decodeURIComponent(image.dataset.avatarCandidates || "[]"));
      } catch (_) {
        return [];
      }
    })();
    const nextIndex = Number(image.dataset.avatarIndex || 0) + 1;
    const nextAvatar = candidates[nextIndex];

    if (nextAvatar) {
      image.dataset.avatarIndex = String(nextIndex);
      image.src = nextAvatar;
      return;
    }

    image.parentElement?.classList.remove("has-player-image");
    image.remove();
  },

  renderPlayerPhoto(player, rating = null, className = "market-player-photo") {
    const avatarCandidates = App.transfers.getPlayerAvatarCandidates(player, rating);
    const avatar = avatarCandidates[0] || "";
    const name = player?.name || rating?.name || "?";
    const fallback = App.utils.escapeHtml(String(name).charAt(0));
    const encodedCandidates = encodeURIComponent(JSON.stringify(avatarCandidates));

    return `
      <span class="${className} ${avatar ? "has-player-image" : ""}">
        ${avatar ? `<img src="${App.utils.escapeHtml(avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-avatar-candidates="${encodedCandidates}" data-avatar-index="0" onerror="App.transfers.handlePlayerPhotoError(this)" />` : ""}
        <i>${fallback}</i>
      </span>
    `;
  },

  getMarketPlayerAvatar(player) {
    const transfermarktId =
      String(player?.transfermarkt_id || player?.transfermarktId || "").trim() ||
      String(player?.transfermarkt_url || player?.transfermarktUrl || "").match(
        /\/spieler\/(\d+)/,
      )?.[1] ||
      "";
    if (!transfermarktId) return "";

    const avatar = App.data?.marketPlayerAvatars?.[transfermarktId] || "";
    return App.transfers.isUsablePlayerAvatar(avatar) ? avatar : "";
  },

  getRatingForPlayerName(playerName) {
    const marketPlayer = App.transfers.findMarketPlayerByName(playerName);
    const marketAvatar = App.transfers.getMarketPlayerAvatar(marketPlayer);
    return (
      App.transfers.findEaRatingForMarketPlayer(
        marketPlayer || { name: playerName },
      ) ||
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

  renderPlayerIdentity(playerName, detail = "", className = "player-identity") {
    const marketPlayer = App.transfers.findMarketPlayerByName(playerName);
    const rating = App.transfers.getRatingForPlayerName(playerName);
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
      .map((row, index) => ({
        player: row.Jogador,
        buyer: row.Comprador,
        fromClub: row.ClubeOrigem,
        overall: Number(row.Overall),
        marketValue: Number(row.ValorTransfermarkt),
        timestamp: row.Timestamp,
        sourceIndex: index,
      }));

    const staticTransfers = App.data.transfers.map((transfer, index) => ({
      ...transfer,
      timestamp: transfer.timestamp || "",
      sourceIndex: index,
    }));

    return [...staticTransfers, ...approvedApiTransfers];
  },

  isApprovedTransferStatus(status) {
    return ["aprovado", "approved"].includes(App.utils.normalizeText(status));
  },

  isMarketPlayerContracted(player) {
    const playerKey = App.transfers.normalizePlayerRatingKey(player?.name);
    if (!playerKey) return false;
    return App.transfers
      .getAllTransfers()
      .some(
        (transfer) =>
          App.transfers.normalizePlayerRatingKey(transfer.player) === playerKey,
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
        totalBudget: Number(
          supabaseBudget.totalBudget ?? App.config.transferBudget,
        ),
        spentTotal: Number(supabaseBudget.spentTotal ?? 0),
        remainingBudget: Number(
          supabaseBudget.remainingBudget ?? App.config.transferBudget,
        ),
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
    const nameCounts = allTransfers.reduce((acc, transfer) => {
      const key = App.utils.normalizeText(transfer.player);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const latestIndexByPlayer = allTransfers.reduce((acc, transfer, index) => {
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
    }, {});
    const spentByBuyer = {};

    return allTransfers.map((transfer, index) => {
      const feeRate = App.transfers.getTransferRate(Number(transfer.overall));
      const totalCost =
        Number(transfer.marketValue || 0) +
        Number(transfer.marketValue || 0) * feeRate;
      const nameKey = App.utils.normalizeText(transfer.player);
      const hasDuplicate = nameCounts[nameKey] > 1;
      const isBlockedDuplicate =
        hasDuplicate && latestIndexByPlayer[nameKey] !== index;
      const countedCost = isBlockedDuplicate ? 0 : totalCost;
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
        feeRate,
        totalCost,
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
      .filter((item) => !item.isBlockedDuplicate);
  },

  getTransferStatusClass(item) {
    if (item.isBlockedDuplicate) return "duplicate";
    if (item.runningSpent > item.currentBudget) return "overbudget";
    return "valid";
  },

  getTransferStatusLabel(item) {
    if (item.isBlockedDuplicate) return "Duplicado";
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

    if (owner !== "all") data = data.filter((item) => item.buyer === owner);
    if (status !== "all")
      data = data.filter(
        (item) => App.transfers.getTransferStatusClass(item) === status,
      );
    if (search) {
      data = data.filter(
        (item) =>
          App.utils.normalizeText(item.player).includes(search) ||
          App.utils.normalizeText(item.buyer).includes(search) ||
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

  getTransferOverall(item) {
    const transferOverall = Number(item?.overall || 0);
    if (transferOverall > 0) return transferOverall;
    const rating = App.transfers.getRatingForPlayerName(item?.player);
    return Number(rating?.overall || 0);
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
        (sum, item) => sum + App.transfers.estimateWeeklySalary(item),
        0,
      );
      const payrollPressure = totalBudget > 0 ? (payrollWeekly * 4) / totalBudget : 0;
      const runwayWeeks = payrollWeekly > 0 ? Math.floor(Math.max(0, remaining) / payrollWeekly) : null;

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
        payrollWeekly,
        payrollPressure,
        runwayWeeks,
      };
    });
  },

  estimateWeeklySalary(item = {}) {
    const overall = Number(item.overall || item.displayOverall || 0);
    const value = Number(item.marketValue || item.totalCost || 0);
    const rules = App.state.apiFinanceRules || {};
    const valueBase = value * Number(rules.market_value_salary_rate || 0.006);
    const floorSalary = Number(rules.base_weekly_salary || 45000);
    const overallMultiplier =
      overall >= 88 ? 1.85 :
        overall >= 84 ? 1.45 :
          overall >= 80 ? 1.18 :
            overall >= 75 ? 1 :
              0.82;
    return Math.round(Math.max(floorSalary, valueBase * overallMultiplier) / 5000) * 5000;
  },

  getAuctionCandidates() {
    return App.transfers
      .getValidTransfers()
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
        const severity =
          item.remaining < 0
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
        .find((item) => App.utils.normalizeText(item.player) === key) || null
    );
  },

  isInternalTransferForm(form) {
    return form?.elements.transferType?.value === "internal";
  },

  getOwnedTransfersByBuyer(buyer) {
    return App.transfers
      .getValidTransfers()
      .filter((item) => item.buyer === buyer)
      .sort((a, b) => a.player.localeCompare(b.player));
  },

  getInternalTransferPlayerByIndex(seller, index) {
    if (index === "" || index === undefined || index === null) return null;
    return (
      App.transfers.getOwnedTransfersByBuyer(seller)[Number(index)] || null
    );
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
    const hasEnoughData = Boolean(
      buyer &&
      player &&
      !Number.isNaN(overall) &&
      !Number.isNaN(marketValue) &&
      overall > 0 &&
      marketValue >= 0,
    );
    const budget = App.transfers
      .getSpendingSummary()
      .find((item) => item.buyer === buyer);
    const rate =
      Number.isNaN(overall) || isInternal
        ? 0
        : App.transfers.getTransferRate(overall);
    const finalValue = Number.isNaN(marketValue)
      ? 0
      : marketValue + marketValue * rate;
    const duplicate = App.transfers.findExistingPlayer(player);
    const internalSellerMismatch = Boolean(
      isInternal && duplicate && seller && duplicate.buyer !== seller,
    );
    const sameBuyerAndSeller = Boolean(
      isInternal && buyer && seller && buyer === seller,
    );
    const duplicateBlock = duplicate && (!isInternal || internalSellerMismatch);
    const remainingAfter = budget ? budget.remaining - finalValue : 0;
    const weeklySalary = App.transfers.estimateWeeklySalary({
      overall,
      marketValue,
      totalCost: finalValue
    });
    const payrollAfter = Number(budget?.payrollWeekly || 0) + weeklySalary;
    const maxPayrollRatio = Number(App.state.apiFinanceRules?.max_payroll_to_budget_ratio || 0.22);
    const payrollCeiling = Number(budget?.totalBudget || App.config.transferBudget) * maxPayrollRatio / 4;
    const payrollBlocked = payrollAfter > payrollCeiling;
    const runwayWeeksAfter = payrollAfter > 0
      ? Math.floor(Math.max(0, remainingAfter) / payrollAfter)
      : null;
    const limitReached =
      !isInternal && budget
        ? budget.transfersToday >= budget.transferLimit
        : false;
    const overBudget = budget ? finalValue > budget.remaining : false;
    const hardBlock = Boolean(
      hasEnoughData &&
      (duplicateBlock || sameBuyerAndSeller || limitReached || overBudget || payrollBlocked),
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
      finalValue,
      duplicate,
      duplicateBlock,
      internalSellerMismatch,
      sameBuyerAndSeller,
      budget,
      remainingAfter,
      weeklySalary,
      payrollAfter,
      payrollCeiling,
      payrollBlocked,
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
        p_reason: "Disputa por jogador ja contratado",
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

    if (!preview?.hasEnoughData) {
      if (submitButton && !submitButton.dataset.submitting)
        submitButton.disabled = false;
      target.className = "transfer-live-preview";
      target.innerHTML = `
        <strong>Prévia da contratação</strong>
        <span>Preencha comprador, jogador, overall e valor para calcular custo final, saldo e travas antes de enviar.</span>
      `;
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
        `Folha acima do teto financeiro: limite recomendado ${App.utils.formatCurrency(preview.payrollCeiling)}/sem.`,
      );
    }

    if (!messages.length) {
      messages.push("Contratação liberada para envio.");
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
      messages.push("A folha pós-compra deixa pouco fôlego de caixa para as próximas semanas.");
    }

    if (submitButton && !submitButton.dataset.submitting) {
      submitButton.disabled = preview.hardBlock;
    }

    target.className = `transfer-live-preview ${preview.hardBlock ? "danger" : "success"}`;
    target.innerHTML = `
      <div class="preview-header">
        <strong>${App.utils.escapeHtml(preview.player)}</strong>
        <span>${preview.buyer}</span>
      </div>
      <div class="preview-grid">
        <span>OVR <strong>${preview.overall}</strong></span>
        <span>Taxa <strong>${Math.round(preview.rate * 100)}%</strong></span>
        <span>${preview.isInternal ? "Valor negociado" : "Custo final"} <strong>${App.utils.formatCurrency(preview.finalValue)}</strong></span>
        <span>Saldo após compra <strong>${App.utils.formatCurrency(preview.remainingAfter)}</strong></span>
        <span>Salário estimado <strong>${App.utils.formatCurrency(preview.weeklySalary)}/sem</strong></span>
        <span>Folha pós-compra <strong>${App.utils.formatCurrency(preview.payrollAfter)}/sem</strong></span>
        <span>${preview.isInternal ? "Limite diário" : "Transferências hoje"} <strong>${preview.isInternal ? "Não consome" : `${preview.budget.transfersToday}/${preview.budget.transferLimit}`}</strong></span>
        <span>Fôlego de caixa <strong>${preview.runwayWeeksAfter === null ? "Sem folha" : `${preview.runwayWeeksAfter} sem.`}</strong></span>
      </div>
      <ul class="preview-alerts">
        ${messages.map((message) => `<li>${App.utils.escapeHtml(message)}</li>`).join("")}
      </ul>
      ${preview.duplicateBlock && !preview.isInternal ? `<button type="button" class="secondary-button" data-open-auto-auction>Abrir leilão automático</button>` : ""}
    `;
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
        : "Valor Transfermarkt";

    if (!isInternal) {
      if (form.elements.seller) form.elements.seller.value = "";
      App.transfers.populateInternalTransferPlayers(form);
      return;
    }

    App.transfers.populateInternalTransferPlayers(form);
    App.transfers.selectInternalTransferPlayer(form);
  },

  populateInternalTransferPlayers(form) {
    const select = document.getElementById("internalTransferPlayer");
    if (!select || !form) return;

    const seller = form.elements.seller?.value || "";
    const players = seller
      ? App.transfers.getOwnedTransfersByBuyer(seller)
      : [];
    const currentValue = select.value;

    select.innerHTML = `
      <option value="">${seller ? "Escolha o jogador" : "Escolha vendedor e jogador"}</option>
      ${players
        .map(
          (item, index) => `
        <option value="${index}">${App.utils.escapeHtml(item.player)} · ${App.utils.formatCurrency(item.totalCost)}</option>
      `,
        )
        .join("")}
    `;

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

    if (!data.length) {
      target.innerHTML = `
        <article class="transfer-movement-card transfer-movement-empty">
          <div class="movement-card-header">
            <span>Movimentações recentes</span>
          </div>
          <strong>Nenhuma transferência aprovada ainda.</strong>
          <p class="calendar-muted">As últimas contratações aprovadas aparecerão aqui.</p>
        </article>
      `;
      return;
    }

    const impactHtml = impactTransfers.length
      ? `
      <article class="transfer-movement-card transfer-impact-spotlight">
        <div class="movement-card-header">
          <span>Contratação impactante</span>
          <small>OVR 89+</small>
        </div>
        <div class="impact-spotlight-grid">
          <div class="impact-spotlight-main">
            ${App.transfers.renderPlayerIdentity(
              impactTransfers[0].player,
              `${impactTransfers[0].fromClub || "Clube não informado"} · ${impactTransfers[0].buyer}`,
              "impact-player-identity",
            )}
            <strong>${App.utils.formatCurrency(impactTransfers[0].totalCost)}</strong>
          </div>
          <div class="impact-spotlight-list">
            ${impactTransfers
              .map(
                (item) => `
              <div>
                <span>OVR ${item.displayOverall}</span>
                <b>${App.utils.escapeHtml(item.player)}</b>
                <small>${App.utils.escapeHtml(item.buyer)} · ${App.utils.formatCurrency(item.totalCost)}</small>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      </article>
    `
      : "";

    target.innerHTML =
      impactHtml +
      data
        .map((item) => {
          const date = item.timestamp
            ? App.utils.formatDateTime(item.timestamp)
            : "Sem data";
          const overall = App.transfers.getTransferOverall(item);
          const isImpact = overall > 88;
          const marketValue = Number(item.marketValue || 0);
          const feePercent = Math.round(Number(item.feeRate || 0) * 100);
          const valueBreakdown = marketValue
            ? `Base ${App.utils.formatCurrency(marketValue)}${feePercent ? ` + ${feePercent}% OVR` : ""}`
            : "Base não informada";
          return `
        <article class="transfer-movement-card ${isImpact ? "is-impact-transfer" : ""}">
          <div class="movement-card-header">
            ${App.ui.ownerBadge(item.buyer)}
            <small>${isImpact ? "Impactante · " : ""}${App.utils.escapeHtml(date)}</small>
          </div>
          <div class="movement-player">
            <span>Contratação</span>
            ${App.transfers.renderPlayerIdentity(item.player, item.fromClub || "Clube não informado", "movement-player-identity")}
          </div>
          <div class="movement-meta">
            <span>${App.utils.escapeHtml(item.fromClub || "Clube não informado")}</span>
            <span>OVR ${overall || "-"}</span>
          </div>
          <div class="movement-value">
            <span>Valor final</span>
            <div class="movement-value-copy">
              <small>${App.utils.escapeHtml(valueBreakdown)}</small>
              <strong>${App.utils.formatCurrency(item.totalCost)}</strong>
            </div>
          </div>
        </article>
      `;
        })
        .join("");
  },

  renderInsights() {
    const target = document.getElementById("transferInsights");
    if (!target) return;

    const transfers = App.transfers.getValidTransfers();
    const biggest = [...transfers]
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 5);
    const recent = App.transfers.getRecentTransferMovements(5);
    const buyers = App.utils
      .getHumanBuyers()
      .map((buyer) => ({
        buyer,
        count: transfers.filter((item) => item.buyer === buyer).length,
      }))
      .sort((a, b) => b.count - a.count);
    const fromClubs = transfers.reduce((acc, item) => {
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

    target.innerHTML = `
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
                .map(
                  (item) => `
          <div class="insight-row">
            <span>${App.transfers.renderPlayerIdentity(item.player, item.buyer, "insight-player-identity")}</span>
            <strong>${App.utils.escapeHtml(item.buyer)}</strong>
          </div>
        `,
                )
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
    `;
  },

  getMarketPlayers() {
    return Array.isArray(App.state.apiMarketPlayers)
      ? App.state.apiMarketPlayers
      : [];
  },

  async searchMarketPlayers(query = "") {
    const showContracted = Boolean(
      document.getElementById("showContractedPlayers")?.checked,
    );
    const normalized = App.utils.normalizeText(query);
    const limit = normalized ? 14 : 8;

    return App.api.loadMarketPlayers(query, showContracted, limit);
  },

  selectMarketPlayer(playerId) {
    const form = document.getElementById("transferForm");
    if (!form) return;

    const player = App.transfers
      .getMarketPlayers()
      .find((item) => String(item.id) === String(playerId));
    if (!player || App.transfers.isMarketPlayerContracted(player)) return;

    if (form.elements.player) form.elements.player.value = player.name || "";
    if (form.elements.fromClub)
      form.elements.fromClub.value = player.club || "";
    if (form.elements.marketValue)
      form.elements.marketValue.value = Math.round(
        App.transfers.getMarketPlayerValue(player),
      );

    const eaRating = App.transfers.findEaRatingForMarketPlayer(player);
    if (eaRating && form.elements.overall)
      form.elements.overall.value = Number(
        eaRating.overall || player.overall || "",
      );

    const search = document.getElementById("marketPlayerSearch");
    if (search) search.value = `${player.name} • ${player.club}`;

    App.transfers.renderTransferPreview(form);
  },

  async renderEaRatingResults(query = "") {
    const target = document.getElementById("eaRatingResults");
    if (!target) return;

    if (!query) {
      target.innerHTML = `<div class="market-empty">Digite o nome do jogador para conferir overall, posição, clube e foto na base importada.</div>`;
      return;
    }

    const ratingGroups = await Promise.all(
      App.transfers.getPlayerSearchAliases(query).map((alias) =>
        App.api.searchEaRatings(alias, 8).catch((error) => {
          console.warn("Busca de rating EA indisponível:", error);
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
      target.innerHTML = `
        <div class="market-empty">
          Nenhum overall/foto importado para "${App.utils.escapeHtml(query)}".
          ${marketMatches.length ? "O jogador existe no mercado, mas ainda precisa entrar na base de ratings." : "Tente nome completo ou confira se ele existe no mercado."}
        </div>
      `;
      return;
    }

    target.innerHTML = ratings
      .map(
        (player) => `
      <button class="ea-rating-option" type="button" data-ea-rating="${App.utils.escapeHtml(player.id || player.ea_id || player.name)}">
        ${App.transfers.renderPlayerPhoto(player, null, "ea-rating-photo")}
        <span>
          <strong>${App.utils.escapeHtml(player.name || "-")}</strong>
          <small>${App.utils.escapeHtml([player.position, player.club, player.nation].filter(Boolean).join(" · "))}</small>
        </span>
        <b>OVR ${Number(player.overall || 0)}</b>
      </button>
    `,
      )
      .join("");

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
        if (form.elements.overall)
          form.elements.overall.value = Number(selected.overall || "");
        App.transfers.renderTransferPreview(form);
      });
    });
  },

  async renderMarketPlayerResults() {
    const target = document.getElementById("marketPlayerResults");
    const input = document.getElementById("marketPlayerSearch");
    if (!target) return;

    const query = input?.value || "";
    target.innerHTML = `<div class="market-empty">Buscando jogadores no mercado...</div>`;

    const players = await App.transfers.searchMarketPlayers(query);
    const ratingRows = await Promise.all(
      players
        .slice(0, 10)
        .map((player) =>
          App.api.searchEaRatings(player.name || "", 3).catch(() => []),
        ),
    );
    App.api.mergeEaRatings?.(ratingRows.flat());

    if (!players.length) {
      target.innerHTML = `
        <div class="market-empty">
          Nenhum jogador disponível encontrado. Tente buscar por nome, clube, liga ou posição.
          ${document.getElementById("showContractedPlayers")?.checked ? "" : " Jogadores já contratados estão escondidos por padrão."}
        </div>
      `;
      return;
    }

    target.innerHTML = players
      .map((player) => {
        const isContracted = App.transfers.isMarketPlayerContracted(player);
        const eaRating = App.transfers.findEaRatingForMarketPlayer(player);
        const overall = Number(eaRating?.overall || player.overall || 0);
        const marketValue = App.transfers.getMarketPlayerValue(player);
        return `
        <button class="market-player-option ${isContracted ? "is-contracted" : ""}" type="button" data-market-player="${player.id}" ${isContracted ? "disabled" : ""}>
          ${App.transfers.renderPlayerPhoto(player, eaRating)}
          <span class="market-player-main">
            <strong>${App.utils.escapeHtml(player.name || "-")}</strong>
            <small>${App.utils.escapeHtml([player.position, player.age ? `${player.age} anos` : "", player.league, player.club].filter(Boolean).join(" · "))}</small>
          </span>
          <span class="market-player-side">
            ${overall ? `<span class="market-player-overall">OVR ${overall}</span>` : ""}
            <span class="market-player-value">${App.utils.formatCurrency(marketValue)}</span>
            ${isContracted ? `<span class="market-player-status">Já contratado</span>` : ""}
          </span>
        </button>
      `;
      })
      .join("");

    target.querySelectorAll("[data-market-player]").forEach((button) => {
      button.addEventListener("click", () =>
        App.transfers.selectMarketPlayer(button.dataset.marketPlayer),
      );
    });
  },

  renderSummary() {
    const summary = document.getElementById("transferSummary");
    if (!summary) return;

    const data = App.transfers.getValidTransfers();
    const recent = App.transfers.getRecentTransferMovements(1)[0];
    const totalMoved = data.reduce(
      (sum, item) => sum + Number(item.totalCost || 0),
      0,
    );
    const biggest = data.reduce(
      (best, item) =>
        Number(item.totalCost || 0) > Number(best?.totalCost || 0)
          ? item
          : best,
      data[0],
    );
    const buyersActive = new Set(data.map((item) => item.buyer)).size;

    summary.innerHTML = `
      ${App.ui.summaryCard("Contratações válidas", data.length)}
      ${App.ui.summaryCard("Total movimentado", App.utils.formatCurrency(totalMoved))}
      ${App.ui.summaryCard("Maior compra", biggest ? App.utils.formatCurrency(biggest.totalCost) : "-")}
      ${App.ui.summaryCard("Compradores ativos", buyersActive)}
      ${App.ui.summaryCard("Última movimentação", recent ? App.utils.escapeHtml(recent.player) : "-")}
    `;
  },

  render() {
    App.transfers.renderSummary();
    App.transfers.renderBudgetBoard();
    App.transfers.renderInsights();
    App.transfers.renderMarketPlayerResults();

    const table = document.getElementById("transferTable");
    const mobile = document.getElementById("transferMobile");
    if (!table || !mobile) return;

    const data = App.transfers.getFilteredTransfers(5);
    if (!data.length) {
      table.innerHTML = `<tr><td colspan="8" class="calendar-muted">Nenhuma transferência aprovada ainda.</td></tr>`;
      mobile.innerHTML = App.ui.emptyCard(
        "Nenhuma transferência cadastrada",
        "Use a aba Enviar dados para cadastrar contratações.",
      );
      return;
    }

    table.innerHTML = data
      .map((item) => {
        const statusClass = App.transfers.getTransferStatusClass(item);
        return `
        <tr class="ours-row">
          <td class="calendar-match">${App.transfers.renderPlayerIdentity(item.player, item.fromClub || "-", "table-player-identity")}</td>
          <td>${App.ui.ownerBadge(item.buyer, App.data.ownerColors["Livre / CPU"])}</td>
          <td>${App.utils.escapeHtml(item.fromClub || "-")}</td>
          <td class="numeric">${item.overall}</td>
          <td>${App.utils.formatCurrency(item.marketValue)}</td>
          <td class="numeric">${Math.round(item.feeRate * 100)}%</td>
          <td>${App.utils.formatCurrency(item.totalCost)}</td>
          <td><span class="transfer-status ${statusClass}">${App.transfers.getTransferStatusLabel(item)}</span></td>
        </tr>
      `;
      })
      .join("");

    mobile.innerHTML = data
      .map((item) => {
        return `
        <article class="calendar-card ours-row">
          <div class="calendar-card-header">${App.ui.ownerBadge(item.buyer, App.data.ownerColors["Livre / CPU"])}<span class="transfer-status ${App.transfers.getTransferStatusClass(item)}">${App.transfers.getTransferStatusLabel(item)}</span></div>
          ${App.transfers.renderPlayerIdentity(item.player, `${item.fromClub || "-"} · OVR ${item.overall}`, "mobile-player-identity")}
          <p>Valor final: <strong>${App.utils.formatCurrency(item.totalCost)}</strong></p>
        </article>
      `;
      })
      .join("");
  },
};
