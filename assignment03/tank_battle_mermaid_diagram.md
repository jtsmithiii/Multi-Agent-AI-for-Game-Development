# Tank Battle: Build Agents, Roles and Data Flow

Twenty single-purpose agents build Tank Battle in seven waves, with no more than three running at once. Three short diagrams answer three questions: **when** each agent runs, **how the game server's pieces connect**, and **how the look, the server and the tests connect**.

## 1. When does each agent run?

The Lead Agent writes the briefs before every wave and checks the handoffs after it. Between waves, you test and approve before the next one starts. After Wave 3 you also test a playable slice.

```mermaid
flowchart LR
  Lead(["Lead Agent<br/>briefs before every wave,<br/>checks after every wave"])
  W0["<b>Wave 0</b><br/>Project Setup"]
  W1["<b>Wave 1</b><br/>Game Logic<br/>World Map<br/>Game Control"]
  W2["<b>Wave 2</b><br/>Collision and Terrain<br/>Round Manager<br/>Session and Join"]
  W3["<b>Wave 3</b><br/>Multiplayer Sync<br/>Wrecker AI<br/>Auxiliaries AI"]
  W4["<b>Wave 4</b><br/>Deployment<br/>UI<br/>Graphics"]
  W5["<b>Wave 5</b><br/>Audio<br/>Effects<br/>Security"]
  W6["<b>Wave 6</b><br/>Playtest<br/>Balance<br/>Load Test"]

  Lead -.-> W0
  W0 -->|"you approve"| W1
  W1 -->|"you approve"| W2
  W2 -->|"you approve"| W3
  W3 -->|"you test the slice"| W4
  W4 -->|"you approve"| W5
  W5 -->|"you approve"| W6

  classDef wave fill:#eef3fb,stroke:#3b6ea8
  class W0,W1,W2,W3,W4,W5,W6 wave
```

## 2. How do the game server's pieces connect?

This is the heart of the game: rules, map, rounds and AI feeding one sync layer that talks to all 20 players. The game-state sheet is the shared contract that Game Logic owns and every agent reads.

```mermaid
flowchart LR
  subgraph PLAYER["Player side"]
    GC["Game Control<br/>input, camera, pings"]
    SJ["Session and Join<br/>colors, queue, player state"]
  end

  subgraph WORLD["World and rules"]
    WM["World Map<br/>map, depots"]
    CT["Collision and Terrain<br/>walls, hits, line of sight"]
    GL["Game Logic<br/>damage, Cells, scoring"]
    RM["Round Manager<br/>timer, spawns, tally"]
  end

  subgraph AI["AI tanks"]
    WR["Wrecker AI"]
    AX["Auxiliaries AI"]
  end

  MS["Multiplayer Sync<br/>sends everything to<br/>all 20 players"]
  GS[("Game-state sheet<br/>read by every agent")]

  GC -->|"input, pings"| MS
  SJ -->|"joins"| MS
  SJ -->|"player state"| RM
  MS -->|"input"| GL
  WM -->|"map"| CT
  WM -->|"map"| WR & AX
  CT -->|"hits"| GL
  CT -->|"line of sight"| WR
  GL -->|"scores, elimination"| RM
  RM -->|"spawn commands"| WR
  GL -->|"rule events"| MS
  RM -->|"timer, round events"| MS
  WR -->|"actions"| MS
  AX -->|"actions"| MS
  GL ==>|"owns"| GS
  GS -.->|"read by"| AI

  style GS fill:#fff4d6,stroke:#b8860b
  style MS fill:#e3f2e1,stroke:#2e7d32
```

## 3. How do the look, the server and the tests connect?

The art, screens and sound all land in the game client. The server code becomes the live server. Then the test agents check both and send their findings back.

```mermaid
flowchart LR
  subgraph LOOK["Look and sound"]
    GR["Graphics<br/>sprites, tiles, logo"]
    UI["UI<br/>splash, menu, HUD"]
    AU["Audio<br/>sounds, music"]
    EF["Effects<br/>explosions, animation"]
  end

  Client(["Game client"])
  MS["Multiplayer Sync<br/>server code"]
  DP["Deployment"]
  Server(["Live server"])

  subgraph CHECKS["Test and tune"]
    PT["Playtest"]
    LT["Load Test"]
    SC["Security"]
    BL["Balance"]
  end

  Tuning[("shared/tuning.ts")]
  Lead(["Lead Agent"])

  GR -->|"sprites"| EF
  GR & UI & AU & EF --> Client
  MS --> DP --> Server
  Client -->|"playable build"| PT
  Server -->|"live server"| LT & SC
  PT -->|"match logs"| BL
  BL -->|"tuned numbers"| Tuning
  PT -->|"bug reports"| Lead
  LT -->|"findings"| MS
  SC -->|"findings"| MS

  style Client fill:#e3f2e1,stroke:#2e7d32
  style Server fill:#e3f2e1,stroke:#2e7d32
  style Tuning fill:#fff4d6,stroke:#b8860b
```

## What each agent does, in one line

| Agent | Its one job |
| --- | --- |
| Project Setup | Builds the project scaffold, shared types, and the Splash, Menu, and game scene order |
| Game Logic | Damage, Cells, depots, refueling, elimination, and scoring |
| World Map | The scrolling map, depots, stations, and depot HP |
| Game Control | Input, aiming, the camera, and ping keys |
| Collision and Terrain | Element walls, shell hits, and line of sight |
| Round Manager | The round timer, Wrecker spawns, tally, and practice mode |
| Session and Join | Color pick, the 20-player cap, queue, and the player state table |
| Multiplayer Sync | The 20-player netcode that sends everything to every player |
| Wrecker AI | Black tanks that roam and hunt the Cell leader |
| Auxiliaries AI | Team-color tanks that defend their depot |
| Deployment | The persistent online game server |
| UI | Splash, menu, HUD, hints, spectator view, and pings |
| Graphics | Tanks, Cells, depots, tiles, logo, and menu art |
| Audio | Sound effects, splash music, and menu music |
| Effects | Explosions and animated terrain |
| Security | Audits the server for cheating and bad input |
| Playtest | Scripted matches and bug reports |
| Balance | Tunes the numbers in the tuning file |
| Load Test | Simulates 20 players against the server |
| Lead | Writes briefs before and checks handoffs after every wave |