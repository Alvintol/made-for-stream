import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";

if (appEnv === "production") {
  throw new Error("Refusing to run dev seed in production.");
}

if (supabaseUrl.includes("your-prod-project-ref")) {
  throw new Error("Refusing to run dev seed against production Supabase.");
}

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Stable placeholder avatars for dev
const avatarUrl = (seed) =>
  `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;

// Made-up creators for dev. Never seed real people: these profiles are
// public on the dev site. The "mfsdemo" channel names don't point at real
// Twitch or YouTube channels.
const creators = [
  {
    key: "creator-fernpixel",
    email: "dev+fernpixel@madeforstream.test",
    handle: "FernPixel",
    displayName: "FernPixel",
    bio: "Demo creator. Cozy stream art, panels and badges.",
    platforms: {
      twitch: {
        login: "mfsdemo_fernpixel",
        profileUrl: "https://twitch.tv/mfsdemo_fernpixel",
      },
      youtube: {
        handle: "@mfsdemo-fernpixel",
        profileUrl: "https://youtube.com/@mfsdemo-fernpixel",
      },
    },
  },
  {
    key: "creator-inkwellotter",
    email: "dev+inkwellotter@madeforstream.test",
    handle: "InkwellOtter",
    displayName: "InkwellOtter",
    bio: "Demo creator. Emotes, overlays and other stream assets.",
    platforms: {
      twitch: {
        login: "mfsdemo_inkwellotter",
        profileUrl: "https://twitch.tv/mfsdemo_inkwellotter",
      },
      youtube: {
        handle: "@mfsdemo-inkwellotter",
        profileUrl: "https://youtube.com/@mfsdemo-inkwellotter",
      },
    },
  },
  {
    key: "creator-mossylantern",
    email: "dev+mossylantern@madeforstream.test",
    handle: "MossyLantern",
    displayName: "MossyLantern",
    bio: "Demo creator. Emotes, sub badges and channel art.",
    platforms: {
      twitch: {
        login: "mfsdemo_mossylantern",
        profileUrl: "https://twitch.tv/mfsdemo_mossylantern",
      },
      youtube: {
        handle: "@mfsdemo-mossylantern",
        profileUrl: "https://youtube.com/@mfsdemo-mossylantern",
      },
    },
  },
  {
    key: "creator-quietcomet",
    email: "dev+quietcomet@madeforstream.test",
    handle: "QuietComet",
    displayName: "QuietComet",
    bio: "Demo creator. Illustration, banners and offline screens.",
    platforms: {
      twitch: {
        login: "mfsdemo_quietcomet",
        profileUrl: "https://twitch.tv/mfsdemo_quietcomet",
      },
      youtube: {
        handle: "@mfsdemo-quietcomet",
        profileUrl: "https://youtube.com/@mfsdemo-quietcomet",
      },
    },
  },
  {
    key: "creator-papermoth",
    email: "dev+papermoth@madeforstream.test",
    handle: "PaperMoth",
    displayName: "PaperMoth",
    bio: "Demo creator. PNG-tuber and VTuber models, and rigging help.",
    platforms: {
      youtube: {
        handle: "@mfsdemo-papermoth",
        profileUrl: "https://youtube.com/@mfsdemo-papermoth",
      },
    },
  },
  {
    key: "creator-clipheron",
    email: "dev+clipheron@madeforstream.test",
    handle: "ClipHeron",
    displayName: "ClipHeron",
    bio: "Demo creator. Clips, VOD and short-form editing with captions.",
    platforms: {
      twitch: {
        login: "mfsdemo_clipheron",
        profileUrl: "https://twitch.tv/mfsdemo_clipheron",
      },
    },
  },
  {
    key: "creator-signalfox",
    email: "dev+signalfox@madeforstream.test",
    handle: "SignalFox",
    displayName: "SignalFox",
    bio: "Demo creator. Mic chains, OBS filters, audio routing and noise cleanup.",
    platforms: {
      twitch: {
        login: "mfsdemo_signalfox",
        profileUrl: "https://twitch.tv/mfsdemo_signalfox",
      },
    },
  },
];

// Listing seed data mapped to the updated creator set
const listings = [
  {
    id: "3b7c0e6c-4f1c-4f2b-9331-5e957c9cb001",
    creatorKey: "creator-inkwellotter",
    title: "Cozy Emote Pack (12)",
    short: "12 emotes + variants. Includes PNG + licence notes.",
    offering_type: "digital",
    category: "emotes",
    video_subtype: null,
    price_type: "fixed",
    price_min: 18,
    price_max: 18,
    deliverables: ["png"],
    tags: ["emotes", "png", "cozy"],
    preview_url: "https://picsum.photos/seed/emotes/960/540",
    status: "published",
    is_active: true,
  },
  {
    id: "3b7c0e6c-4f1c-4f2b-9331-5e957c9cb002",
    creatorKey: "creator-inkwellotter",
    title: "Custom Stream Overlay Package",
    short: "Panels, starting soon, alerts styling. Handoff-ready.",
    offering_type: "commission",
    category: "overlays",
    video_subtype: null,
    price_type: "starting_at",
    price_min: 180,
    price_max: null,
    deliverables: ["png", "psd", "obs"],
    tags: ["overlays", "obs", "panels"],
    preview_url: "https://picsum.photos/seed/overlay/960/540",
    status: "published",
    is_active: true,
  },
  {
    id: "3b7c0e6c-4f1c-4f2b-9331-5e957c9cb003",
    creatorKey: "creator-papermoth",
    title: "PNG-tuber Model (Full Set)",
    short: "Expressions + layers with clean naming and export plan.",
    offering_type: "commission",
    category: "pngtuber-models",
    video_subtype: null,
    price_type: "range",
    price_min: 120,
    price_max: 420,
    deliverables: ["png", "psd", "model"],
    tags: ["pngtuber", "vtuber", "model"],
    preview_url: "https://picsum.photos/seed/pngtuber/960/540",
    status: "published",
    is_active: true,
  },
  {
    id: "3b7c0e6c-4f1c-4f2b-9331-5e957c9cb004",
    creatorKey: "creator-clipheron",
    title: "Short-form Edit (1–3 videos)",
    short: "Captions, pacing, sound design. Ready for TikTok/Reels/Shorts.",
    offering_type: "service",
    category: "video-editing",
    video_subtype: "short-form",
    price_type: "starting_at",
    price_min: 90,
    price_max: null,
    deliverables: ["video", "project"],
    tags: ["video-editing", "short-form", "captions"],
    preview_url: "https://picsum.photos/seed/editing/960/540",
    status: "published",
    is_active: true,
  },
  {
    id: "3b7c0e6c-4f1c-4f2b-9331-5e957c9cb005",
    creatorKey: "creator-signalfox",
    title: "Audio Troubleshooting Call (45 min)",
    short: "Mic chain, OBS filters, routing, noise cleanup — live help.",
    offering_type: "service",
    category: "audio-tech-help",
    video_subtype: null,
    price_type: "fixed",
    price_min: 45,
    price_max: 45,
    deliverables: ["call", "guide"],
    tags: ["audio", "obs", "filters"],
    preview_url: "https://picsum.photos/seed/audio/960/540",
    status: "published",
    is_active: true,
  },
  {
    id: "3b7c0e6c-4f1c-4f2b-9331-5e957c9cb006",
    creatorKey: "creator-papermoth",
    title: "PNG/VTuber Rigging Help (Live Session)",
    short: "Rig troubleshooting, export pipeline, naming, physics basics, handoff checklist.",
    offering_type: "service",
    category: "vtuber-rigging",
    video_subtype: null,
    price_type: "fixed",
    price_min: 60,
    price_max: 60,
    deliverables: ["call", "guide"],
    tags: ["vtuber-rigging", "rigging", "live-session"],
    preview_url: "https://picsum.photos/seed/rigging/960/540",
    status: "published",
    is_active: true,
  },
];

// Reads all auth users so we can reuse them if the script is run again
const listAllUsers = async () => {
  const users = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw error;

    const batch = data?.users ?? [];
    users.push(...batch);

    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
};

const getOrCreateAuthUser = async (email, displayName) => {
  const users = await listAllUsers();
  const existing = users.find(
    (user) => String(user.email || "").toLowerCase() === email.toLowerCase()
  );

  if (existing) return existing;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: "dev-password-1234",
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
    },
  });

  if (error) throw error;
  if (!data?.user?.id) {
    throw new Error(`Could not create auth user for ${email}`);
  }

  return data.user;
};

const upsertProfile = async (userId, creator) => {
  const now = new Date().toISOString();
  const fallbackAvatar = avatarUrl(creator.handle);

  const { error } = await supabaseAdmin.from("profiles").upsert(
    {
      user_id: userId,
      handle: creator.handle,
      display_name: creator.displayName,
      bio: creator.bio,
      avatar_url: fallbackAvatar,
      display_name_auto: false,
      profile_setup_seen: true,
      profile_setup_completed_at: now,
      updated_at: now,
    },
    {
      onConflict: "user_id",
    }
  );

  if (error) throw error;
};

const upsertPlatformAccounts = async (userId, creator) => {
  const now = new Date().toISOString();
  const fallbackAvatar = avatarUrl(creator.handle);
  const rows = [];

  if (creator.platforms?.twitch) {
    rows.push({
      profile_user_id: userId,
      platform: "twitch",
      platform_user_id: `twitch-${creator.handle.toLowerCase()}`,
      platform_login: creator.platforms.twitch.login,
      platform_display_name: creator.displayName,
      profile_url: creator.platforms.twitch.profileUrl,
      account_created_at: "2024-01-01T00:00:00.000Z",
      connected_at: now,
      metadata: {
        profile_image_url: fallbackAvatar,
        email: creator.email,
        age_ok: true,
      },
      updated_at: now,
    });
  }

  if (creator.platforms?.youtube) {
    rows.push({
      profile_user_id: userId,
      platform: "youtube",
      platform_user_id: `youtube-${creator.handle.toLowerCase()}`,
      platform_login: creator.platforms.youtube.handle ?? null,
      platform_display_name: creator.displayName,
      profile_url: creator.platforms.youtube.profileUrl,
      account_created_at: "2024-01-01T00:00:00.000Z",
      connected_at: now,
      metadata: {},
      updated_at: now,
    });
  }

  if (rows.length === 0) return;

  const { error } = await supabaseAdmin
    .from("profile_platform_accounts")
    .upsert(rows, {
      onConflict: "profile_user_id,platform",
    });

  if (error) throw error;
};

const upsertListings = async (creatorUserIdByKey) => {
  const now = new Date().toISOString();

  const rows = listings.map((listing) => {
    const userId = creatorUserIdByKey[listing.creatorKey];

    if (!userId) {
      throw new Error(`Missing user id for listing creator ${listing.creatorKey}`);
    }

    return {
      id: listing.id,
      user_id: userId,
      title: listing.title,
      short: listing.short,
      offering_type: listing.offering_type,
      category: listing.category,
      video_subtype: listing.video_subtype,
      price_type: listing.price_type,
      price_min: listing.price_min,
      price_max: listing.price_max,
      deliverables: listing.deliverables,
      tags: listing.tags,
      preview_url: listing.preview_url,
      status: listing.status,
      is_active: listing.is_active,
      updated_at: now,
    };
  });

  const { error } = await supabaseAdmin.from("listings").upsert(rows, {
    onConflict: "id",
  });

  if (error) throw error;
};

const run = async () => {
  const creatorUserIdByKey = {};

  for (const creator of creators) {
    const authUser = await getOrCreateAuthUser(creator.email, creator.displayName);
    creatorUserIdByKey[creator.key] = authUser.id;

    await upsertProfile(authUser.id, creator);
    await upsertPlatformAccounts(authUser.id, creator);
  }

  await upsertListings(creatorUserIdByKey);

  console.log("Seeded dev creators, platform accounts, and listings.");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});