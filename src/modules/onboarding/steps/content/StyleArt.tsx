import type { ReactNode } from "react";
import type { ImageStyle, VideoStyle } from "@/core/onboarding/options";

// Small line sketches of each post style: grey photo areas, line icons and text lines.
// Colours come from the theme tokens, so both themes work.

const c = (token: string) => `var(--color-ob-${token})`;
const C = {
  bg: c("bg"),
  card: c("surface"),
  line: c("line"),
  photo: c("sunken"),
  photo2: c("line"),
  ico: c("muted"),
  text: c("line-strong"),
  ink: c("ink"),
  pri: c("primary"),
  priSoft: c("primary-soft"),
  onPri: c("on-primary"),
  dark: c("dark"),
  onDark: c("on-dark"),
  gold: c("warn"),
  ok: c("success"),
  danger: c("danger"),
};
const FONT = "var(--font-ob), system-ui, sans-serif";

// Lucide-style line icons on a 24×24 grid
const ICONS: Record<string, ReactNode> = {
  box: (
    <>
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
      <path d="M12 22V12" />
      <path d="m3.3 7 7.7 4.73a2 2 0 0 0 2 0L20.7 7" />
      <path d="m7.5 4.27 9 5.15" />
    </>
  ),
  wrench: (
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" />
    </>
  ),
  mic: (
    <>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),
  phone: (
    <>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M12 18h.01" />
    </>
  ),
  scissors: (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4 8.12 15.88" />
      <path d="M14.47 14.48 20 20" />
      <path d="M8.12 8.12 12 12" />
    </>
  ),
  sparkle: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" />,
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  ruler: (
    <>
      <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" />
      <path d="m14.5 12.5 2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  video: (
    <>
      <path d="m16 13 5.22 3.48a.5.5 0 0 0 .78-.42V7.87a.5.5 0 0 0-.75-.43L16 10.5" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </>
  ),
};

function Icon({ name, cx, cy, size, color = C.ico, sw = 1.6 }: { name: string; cx: number; cy: number; size: number; color?: string; sw?: number }) {
  return (
    <g
      transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 24})`}
      fill="none"
      stroke={color}
      strokeWidth={(sw * 24) / size}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name]}
    </g>
  );
}

const Bar = ({ x, y, w, h = 5, fill = C.text }: { x: number; y: number; w: number; h?: number; fill?: string }) => (
  <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} />
);

function Chip({ x, y, w, text, bg, fg, size = 6.5 }: { x: number; y: number; w: number; text: string; bg: string; fg: string; size?: number }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={size + 7} rx={(size + 7) / 2} fill={bg} />
      <text x={x + w / 2} y={y + size + 1.8} textAnchor="middle" fontSize={size} fontWeight={700} fill={fg} fontFamily={FONT}>
        {text}
      </text>
    </>
  );
}

function Stars({ x, y, size = 7 }: { x: number; y: number; size?: number }) {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <path
          key={i}
          transform={`translate(${x + i * (size + 2)} ${y}) scale(${size / 24})`}
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"
          fill={C.gold}
        />
      ))}
    </>
  );
}

const Frame = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 120 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true" className="absolute inset-0 size-full">
    <rect width="120" height="150" fill={C.bg} />
    {children}
  </svg>
);

/** A square feed post: a card on a soft background. */
const Post = ({ children }: { children: ReactNode }) => (
  <Frame>
    <rect x="14" y="17" width="92" height="116" rx="7" fill={C.card} stroke={C.line} />
    {children}
  </Frame>
);

/** A phone playing a short video: progress bar, sound icon, caption lines. */
function Reel({ children, sound, caption = 2 }: { children: ReactNode; sound?: "music" | "mic"; caption?: number }) {
  return (
    <Frame>
      <rect x="31" y="8" width="58" height="134" rx="10" fill={C.dark} />
      <rect x="34" y="11" width="52" height="128" rx="7.5" fill={C.photo} />
      {children}
      <Bar x={39} y={16} w={42} h={2} fill={C.onDark} />
      <Bar x={39} y={16} w={16} h={2} fill={C.pri} />
      {caption > 0 && (
        <>
          <rect x="39" y={116 - (caption - 1) * 8} width="42" height={6 + caption * 8} rx="3" fill={C.dark} opacity={0.8} />
          {Array.from({ length: caption }, (_, i) => (
            <Bar key={i} x={43} y={120 - (caption - 1) * 8 + i * 8} w={i ? 26 : 34} h={3.5} fill={C.onDark} />
          ))}
        </>
      )}
      {sound && <Icon name={sound} cx={78} cy={28} size={9} color={C.dark} sw={2} />}
    </Frame>
  );
}

type Words = (product: string, service: string) => string;

function imageArt(style: ImageStyle, subject: string, t: Words): ReactNode {
  switch (style) {
    case "product":
      return (
        <Post>
          <rect x="20" y="23" width="80" height="104" rx="4" fill={C.photo} />
          <ellipse cx="60" cy="104" rx="20" ry="3.5" fill={C.photo2} />
          <Icon name={subject} cx={60} cy={72} size={40} sw={1.4} />
        </Post>
      );
    case "life":
      return (
        <Post>
          <rect x="20" y="23" width="80" height="104" rx="4" fill={C.photo} />
          <path d="M20 106 L 46 78 L 62 94 L 76 82 L 100 106 L 100 123 a4 4 0 0 1 -4 4 L 24 127 a4 4 0 0 1 -4 -4 Z" fill={C.photo2} />
          <circle cx="82" cy="44" r="7" fill={C.photo2} />
          <Icon name={subject} cx={48} cy={58} size={22} sw={1.5} />
          <Chip x={24} y={28} w={44} text={t("Real setting", "At work")} bg={C.card} fg={C.ink} size={6} />
        </Post>
      );
    case "people":
      return (
        <Post>
          <rect x="20" y="23" width="80" height="104" rx="4" fill={C.photo} />
          <Icon name="user" cx={60} cy={70} size={46} sw={1.2} />
          <Icon name={subject} cx={74} cy={96} size={16} color={C.pri} sw={1.8} />
          <rect x="24" y="28" width="44" height="13" rx="6.5" fill={C.card} />
          <circle cx="31" cy="34.5" r="3.5" fill={C.priSoft} />
          <text x="37" y="37" fontSize="6" fontWeight={700} fill={C.ink} fontFamily={FONT}>
            {t("In use", "Expert")}
          </text>
        </Post>
      );
    case "promo":
      return (
        <Post>
          <rect x="20" y="23" width="80" height="62" rx="4" fill={C.photo} />
          <Icon name={t(subject, "calendar")} cx={60} cy={54} size={30} sw={1.4} />
          <Chip x={72} y={28} w={24} text="-20%" bg={C.pri} fg={C.onPri} size={7} />
          <Bar x={22} y={93} w={56} h={6} fill={C.ink} />
          <Bar x={22} y={104} w={40} h={4} />
          <Chip x={22} y={113} w={38} text={t("Shop now", "Book now")} bg={C.pri} fg={C.onPri} size={6} />
          <Bar x={74} y={116} w={24} h={6} fill={C.ink} />
        </Post>
      );
    case "tips":
      return (
        <Frame>
          <rect x="24" y="21" width="88" height="108" rx="7" fill={C.photo} stroke={C.line} />
          <rect x="8" y="17" width="92" height="116" rx="7" fill={C.card} stroke={C.line} />
          <Chip x={76} y={23} w={18} text="1/5" bg={C.ink} fg={C.card} size={6} />
          <Bar x={16} y={34} w={52} h={6} fill={C.ink} />
          <Bar x={16} y={44} w={38} h={6} fill={C.ink} />
          {[64, 82, 100].map((y, i) => (
            <g key={y}>
              <circle cx="22" cy={y + 2} r="5.5" fill={C.priSoft} />
              <text x="22" y={y + 4.5} textAnchor="middle" fontSize="6.5" fontWeight={800} fill={C.pri} fontFamily={FONT}>
                {i + 1}
              </text>
              <Bar x={32} y={y} w={52 - i * 6} h={4} fill={C.ink} />
              <Bar x={32} y={y + 7} w={40 - i * 4} h={3} />
            </g>
          ))}
          <circle cx="47" cy="124" r="1.8" fill={C.ink} />
          <circle cx="54" cy="124" r="1.8" fill={C.text} />
          <circle cx="61" cy="124" r="1.8" fill={C.text} />
          <Icon name="arrow" cx={108} cy={75} size={10} sw={2} />
        </Frame>
      );
    case "review":
      return (
        <Post>
          <Stars x={24} y={30} size={9} />
          <text x="22" y="66" fontSize="30" fontWeight={800} fill={C.priSoft} fontFamily={FONT}>
            &ldquo;
          </text>
          <Bar x={24} y={62} w={70} fill={C.ink} />
          <Bar x={24} y={72} w={64} fill={C.ink} />
          <Bar x={24} y={82} w={50} fill={C.ink} />
          <line x1="24" x2="96" y1="98" y2="98" stroke={C.line} />
          <circle cx="31" cy="112" r="7" fill={C.photo2} />
          <Icon name="user" cx={31} cy={112} size={9} sw={2} />
          <Bar x={42} y={107} w={30} h={4} fill={C.ink} />
          <text x="42" y="120" fontSize="5.5" fontWeight={700} fill={C.ok} fontFamily={FONT}>
            {t("✓ Verified buyer", "✓ Verified client")}
          </text>
        </Post>
      );
    case "ba":
      return (
        <Post>
          <rect x="20" y="23" width="39" height="104" rx="4" fill={C.photo2} />
          <rect x="61" y="23" width="39" height="104" rx="4" fill={C.priSoft} />
          <Icon name={subject} cx={39.5} cy={78} size={24} sw={1.5} />
          <Icon name={subject} cx={80.5} cy={78} size={24} color={C.pri} sw={1.5} />
          <Icon name="sparkle" cx={92} cy={60} size={10} color={C.pri} sw={1.8} />
          <Chip x={24} y={28} w={31} text="BEFORE" bg={C.card} fg={C.ink} size={5.5} />
          <Chip x={65} y={28} w={31} text="AFTER" bg={C.pri} fg={C.onPri} size={5.5} />
        </Post>
      );
    case "bts":
      return (
        <Post>
          <rect x="20" y="23" width="80" height="104" rx="4" fill={C.photo} />
          <Icon name="scissors" cx={46} cy={70} size={24} />
          <Icon name="ruler" cx={76} cy={82} size={22} />
          <rect x="30" y="96" width="60" height="14" rx="3" fill={C.photo2} />
          <Chip x={24} y={28} w={64} text={t("Behind the scenes", "A day at work")} bg={C.card} fg={C.ink} size={6} />
        </Post>
      );
  }
}

function videoArt(style: VideoStyle, subject: string, t: Words): ReactNode {
  switch (style) {
    case "showcase":
      return (
        <Reel sound="music" caption={1}>
          <Icon name={subject} cx={60} cy={64} size={30} sw={1.4} />
          <circle cx="72" cy="76" r="10" fill="none" stroke={C.ico} strokeWidth="1.6" />
        </Reel>
      );
    case "faceless":
      return (
        <Reel sound="mic">
          <path d="M34 92 L 50 72 L 62 84 L 72 74 L 86 92 L 86 131.5 a7.5 7.5 0 0 1 -7.5 7.5 L 41.5 139 a7.5 7.5 0 0 1 -7.5 -7.5 Z" fill={C.photo2} />
          <Icon name={subject} cx={52} cy={56} size={18} />
        </Reel>
      );
    case "talking":
      return (
        <Reel sound="mic">
          <Icon name="user" cx={60} cy={66} size={40} sw={1.2} />
          <circle cx="44" cy="30" r="2.5" fill={C.danger} />
          <text x="49" y="32" fontSize="5.5" fontWeight={800} fill={C.ink} fontFamily={FONT}>
            REC
          </text>
        </Reel>
      );
    case "ugc":
      return (
        <Reel sound="mic">
          <Icon name="phone" cx={50} cy={64} size={22} />
          <Icon name="user" cx={70} cy={62} size={22} />
          <rect x="39" y="84" width="42" height="11" rx="5.5" fill={C.card} />
          <Stars x={43} y={86.5} size={6} />
        </Reel>
      );
    case "howto":
      return (
        <Reel sound="mic">
          <Chip x={39} y={24} w={36} text="STEP 2 OF 3" bg={C.pri} fg={C.onPri} size={5} />
          <Icon name={subject} cx={60} cy={64} size={28} sw={1.4} />
          <Icon name="arrow" cx={60} cy={90} size={12} color={C.pri} sw={2} />
        </Reel>
      );
    case "bts":
      return (
        <Reel caption={1}>
          <Icon name="scissors" cx={52} cy={62} size={20} />
          <Icon name="video" cx={70} cy={80} size={18} />
          <Chip x={39} y={24} w={42} text={t("MAKING OF", "ON THE JOB")} bg={C.card} fg={C.ink} size={5} />
        </Reel>
      );
    case "ba":
      return (
        <Reel sound="music" caption={0}>
          <rect x="34" y="11" width="26" height="128" fill={C.photo2} />
          <rect x="60" y="11" width="26" height="128" fill={C.priSoft} />
          <Icon name={subject} cx={47} cy={70} size={16} />
          <Icon name={subject} cx={73} cy={70} size={16} color={C.pri} />
          <Chip x={37} y={24} w={21} text="BEFORE" bg={C.card} fg={C.ink} size={4.5} />
          <Chip x={63} y={24} w={20} text="AFTER" bg={C.pri} fg={C.onPri} size={4.5} />
        </Reel>
      );
    case "slides":
      return (
        <Reel sound="music" caption={1}>
          <rect x="41" y="38" width="34" height="44" rx="3" fill={C.photo2} transform="rotate(-8 58 60)" />
          <rect x="45" y="42" width="34" height="44" rx="3" fill={C.card} stroke={C.line} transform="rotate(6 62 64)" />
          <Icon name="image" cx={62} cy={64} size={16} />
          <Icon name="arrow" cx={74} cy={98} size={10} sw={2} />
        </Reel>
      );
  }
}

export function StyleArt({ kind, style, service }: { kind: "image" | "video"; style: ImageStyle | VideoStyle; service: boolean }) {
  const t: Words = (product, svc) => (service ? svc : product);
  const subject = service ? "wrench" : "box";
  return <>{kind === "image" ? imageArt(style as ImageStyle, subject, t) : videoArt(style as VideoStyle, subject, t)}</>;
}
