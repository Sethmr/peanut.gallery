# Best-in-Class Onboarding for Consumer BYOK AI Products: A Practical Playbook for a Multi-Provider Chrome Extension

A consumer Chrome extension that listens to browser content and generates jokes/advice via user-supplied LLM API keys sits at the intersection of two notoriously tricky onboarding problems: (1) getting non-developer consumers through a technical, multi-provider API-key setup without bleeding 80%+ of installs, and (2) explaining an "always-observing" data-access model in a way that earns trust rather than panic-uninstalls. This report synthesizes how ~30 leading BYOK products (Raycast, TypingMind, Msty, BoltAI, MindMac, Jan, AnythingLLM, LibreChat, Chatbox, LobeHub, Cursor, Zed, Cline/Roo Code, Obsidian Copilot, Monica, Voilà, OpenRouter, HeyHelp, Chatsistant, Factory, SurfMind, ngrok AI Gateway, and others) handle this, what the empirical numbers say, and how to combine the best practices into a concrete flow you can ship.

---

## 1. The Strategic Frame: BYOK Consumer Onboarding Has a 60-Second Budget

Two data points set the ceiling for everything below. First, "86% of users decide within the first few minutes whether to keep an extension" and poorly-designed onboarding can produce an 80% abandonment rate on Chrome extensions ([ExtensionBooster](https://extensionbooster.com/blog/best-practices-build-browser-extension/)). Second, modern AI-product benchmarks now demand what Productled calls "60-seconds-to-value" — "users must reach meaningful output fast or they drop off" and the best first-run experience is "shareworthy—good enough that users want to recommend or share it immediately" ([ProductLed](https://productled.com/blog/ai-onboarding)). Mozilla's own 2018 user research on extensions found that "poor post-install tabs can erode any trust people had gained in an extension…so much so, that in some cases study participants wanted to immediately remove the extension" and that "too much information or protracted setup requirements can have a similar negative impact" ([Firefox Extension Workshop](https://extensionworkshop.com/documentation/develop/onboard-upboard-offboard-users/)).

The implication for a BYOK product is brutal: every step between install and a first generated joke is a tax on activation, and the API-key hurdle alone is already taxing. ProductLed's study of 450+ B2B SaaS companies found "companies with the shortest onboarding time are seeing 62% better free-to-paid conversion rates" ([Saltfish](https://www.saltfish.ai/blog/why-onboarding-is-the-strongest-lever-for-activation-rate)), and research cited by SaaSFactor indicates "users who activate within 3 days are 90% more likely to continue using your product" ([SaaSFactor](https://www.saasfactor.co/blogs/the-science-of-saas-onboarding-a-comprehensive-framework-for-reducing-friction-improving-activation-and-preventing-churn)). So the central design question is not "how do we collect a key?" — it's "how do we make the user laugh before they ever touch an API key?"

---

## 2. Why BYOK Exists (and What Consumers Need to Understand About It)

BYOK means the user pastes an API key from an LLM provider into the app, and the provider bills them directly for each token used ([Scribelet](https://scribelet.app/blog/byok-ai); [HeyHelp](https://www.heyhelp.ai/byok/)). The consumer benefit is threefold and should be messaged upfront:

- **Cost transparency**: "You only pay for what you use (instead of a monthly subscription like ChatGPT Plus)" ([TypingMind GitHub](https://github.com/TypingMind/typingmind)).
- **Privacy**: Prompts don't go through an intermediate server and "will NOT be used for training by OpenAI/Claude/etc." ([TypingMind GitHub](https://github.com/TypingMind/typingmind)); BoltAI similarly emphasizes "no middle servers. Your prompts are sent directly to OpenAI" ([BoltAI](https://boltai.com/inline)).
- **No vendor lock-in and no double-paying**: HeyHelp puts it bluntly: "Use three apps. Get the same GPT-4 under the hood. Pay three times. That didn't feel right" ([HeyHelp](https://www.heyhelp.ai/byok/)). Scribelet notes users may already be paying "$20/month for ChatGPT Plus, $10/month for an AI writing tool, and $19/month for an AI…" and BYOK collapses that to a single metered bill ([Scribelet](https://scribelet.app/blog/byok-ai)).

But BYOK also exposes the user to real risks that onboarding must pre-empt:

- **Surprise bills**: Rilna calls this the #1 BYOK pitfall: "a burst of experiments can become expensive quickly. It's not evil; it's physics" ([Rilna](https://www.rilna.net/blog/bring-your-own-api-key-byok-tools-guide-examples)). Morph notes "a typical heavy user on Claude Sonnet 4.6 spends $50-200/month in API tokens" on BYOK agent tools ([Morph](https://www.morphllm.com/comparisons/cline-alternatives)).
- **Billing anxiety**: Macaron observed that "the constant billing anxiety eats productivity" for BYOK users ([Macaron](https://macaron.im/blog/openclaw-cost-guide)).
- **Chicken-and-egg friction**: OpenAI requires a prepaid balance before keys actually work — TypingMind's docs explicitly warn "if you haven't set up a payment method for pre-paid billing yet, you'll need to do so. Otherwise, the API Key you just created won't work" ([TypingMind](https://docs.typingmind.com/chat-models-settings/get-openai-api-key)). Anthropic is the same ([Promptitude](https://help.promptitude.io/en/articles/11166436-how-to-get-your-api-key-for-anthropic)), and Google AI Studio may now require "prepaid billing for new accounts" starting March 2026 ([FindSkill.ai](https://findskill.ai/blog/gemini-api-pricing-guide/)).

---

## 3. Case Studies: How 15+ BYOK Products Actually Onboard

### 3.1 TypingMind (web chat UI, consumer-adjacent)
TypingMind's model is provider-agnostic. Setup: user clicks the profile/gear icon, selects the provider card (OpenAI, Anthropic, Google), and pastes a key per provider — "you get the API key directly from the AI provider, not for each specific model. For example, if you want to use all GPT models, you only need to enter the API key from OpenAI" ([TypingMind](https://docs.typingmind.com/quickstart/get-started-with-typingmind)). They publish a dedicated "How to get OpenAI API key" tutorial with screenshots for every click, including the critical prepaid-billing gotcha ([TypingMind](https://docs.typingmind.com/chat-models-settings/get-openai-api-key)). Their FAQ explicitly answers trust questions like "Is my API Key encrypted in local storage?" ([TypingMind FAQ](https://docs.typingmind.com/general-faqs)).

### 3.2 Msty (desktop, local + remote)
Msty's first-run wizard presents exactly three cards: **Setup Local AI**, **Add Remote Models Provider**, and **Use Ollama Models (Advanced)**. Picking local auto-downloads Gemma 2; picking remote prompts the user to add keys for xAI, Gemini, Claude, OpenAI, etc. ([Msty Docs](https://docs.msty.app/getting-started/onboarding); [Msty Studio Docs](https://msty-studio-docs.nuxt.dev/getting-started/onboarding)). Crucially, "the quickest way to get started is to proceed with a local model. You can add additional local and online models later" — they do **not** force users to configure everything upfront.

### 3.3 BoltAI / MindMac (native macOS, consumer-facing)
BoltAI completes setup "in 2 minutes" ([BoltAI](https://docs.boltai.com/docs/start/setup)): Settings → Models → Add API Key → paste and **"make sure the key is correctly validated and working before proceeding"** ([BoltAI](https://docs.boltai.com/blog/how-to-get-chatgpt-api-key)). They store keys in Apple Keychain and offer an optional user-passphrase for an additional encryption layer — "you can set a custom passphrase to encrypt your API keys. This way no body can see your keys, not even me as the app developer" ([BoltAI](https://help.boltai.com/articles/2306606-features)). They support per-provider step-by-step guides (OpenAI, Anthropic, Mistral, Perplexity, Replicate, Azure, OpenRouter, custom OpenAI-compatible), each hosted at a dedicated URL like `/help/how-to-create-an-openai-api-key` ([BoltAI](https://docs.boltai.com/docs/guides/how-to-create-an-openai-api-key)). MindMac takes the same Keychain-plus-no-middle-server stance ([MindMac](https://mindmac.app/index.html)).

### 3.4 Raycast (freemium + BYOK)
Raycast is the gold standard for **hybrid onboarding**: "We provide a limited number of free messages to any Raycast user to give AI a try" before asking for anything ([Raycast](https://www.raycast.com/core-features/ai)). Users who want unlimited usage can either subscribe to Pro or "BYOK — we currently support custom keys for OpenAI, Anthropic and Google" ([Raycast](https://www.raycast.com/pro); [Raycast Manual](https://manual.raycast.com/ai)). Advanced users can add any OpenAI-compatible endpoint via "Bring Your Own Models (Custom Providers)," gated behind an explicit experiments toggle to avoid overwhelming novices ([Raycast Changelog](https://www.raycast.com/changelog/macos)).

### 3.5 Cursor / Zed / JetBrains (IDE, developer-skewed but instructive)
JetBrains AI Assistant makes BYOK the first choice on the AI chat start screen: "select Bring Your Own API Key on the AI chat start screen. Choose a provider, enter your API key, and the available models will automatically appear in your model picker" ([JetBrains](https://blog.jetbrains.com/ai/2025/12/bring-your-own-key-byok-is-now-live-in-jetbrains-ides/)). Zed goes further on the security front: "API keys are not stored as plain text in your settings file, but rather in your OS's secure credential storage" and the UI flow is consistent — "go to the Agent Panel settings, look for the desired provider, paste the key into the input, and hit enter" ([Zed](https://zed.dev/docs/ai/llm-providers)). Cursor offers a 14-day Pro trial with 250 fast premium uses "no payment details are required upfront" before the user ever has to think about BYOK ([daily.dev](https://daily.dev/blog/setup-cursor-first-time)).

### 3.6 Cline / Roo Code / Kilo Code (VSCode extensions)
These are BYOK-first agentic coding tools. Kilo Code offers three tiers of onboarding friction to match user sophistication: **BYOK** (60+ providers, zero markup), **Kilo Pass** ($19/month managed credits, "no API key setup needed"), and **Free Credits** ($20 for new users to try any model) ([Morph](https://www.morphllm.com/comparisons/kilo-code-vs-cline)). This "try for free → swap in your own key → upgrade to managed" ladder is a replicable consumer pattern.

### 3.7 Obsidian Copilot (plugin)
Obsidian Copilot centralizes 15+ providers in a single settings pane, with OpenRouter as the default because it offers the lowest-friction single-key-for-many-models path ([DeepWiki Obsidian Copilot](https://deepwiki.com/logancyang/obsidian-copilot/2-getting-started)). Its in-app guidance is essentially a tutorial: "Go to OpenAI API Platform by clicking the link to Get OpenAI Key … Note: Ensure you have a billing account setup" ([Obsidian Copilot Docs](https://www.obsidiancopilot.com/en/docs/getting-started)).

### 3.8 AnythingLLM (desktop/Docker)
The desktop app ships with a **built-in free fallback LLM** ("AnythingLLM contains a collection of open source models, including Llama3.2 and Gemma, that do not require any additional setup and are free to use") so the user reaches first value with zero keys, then can upgrade to a BYOK provider from the same picker ([DEV Community](https://dev.to/samder/getting-started-with-local-llms-using-anythingllm-47gl)).

### 3.9 Chatbox (desktop/mobile)
Chatbox deliberately offers both a subscription Chatbox-AI option ("no API Key configuration needed, just subscribe and start") *and* a BYOK path in the same app, with a comparison table that sets expectations: "Chatbox AI – simple login and subscribe / BYOK – requires obtaining and managing your own API keys" ([Chatbox Guide](https://chatboxai.app/en/guide/getting-started/choose-provider); [Skywork Chatbox](https://skywork.ai/skypage/en/Chatbox-AI-Deep-Dive-The-Ultimate-Guide-to-Your-All-in-One-AI-Workspace/1972841652357361664)).

### 3.10 LibreChat / LobeHub / Msty / Jan (multi-provider power tools)
These all use a **provider catalog** UI: a grid of provider cards (OpenAI, Anthropic, Google, Groq, Mistral, DeepSeek, local/Ollama, OpenAI-compatible "custom"), each expandable into a form with Base URL, API Key, and Model dropdown ([LobeHub](https://lobehub.com/docs/usage/start); [Jan Docs](https://www.jan.ai/docs/desktop/manage-models); [Chatbox Model Config](https://docs.chatboxai.app/en/guides/providers)). Jan's pattern is typical: "Go to Settings > Model Providers, select your provider, and enter your API key." The LobeHub changelog mentions a "new guided onboarding path" being added in a 2026 release precisely because catalog-style onboarding has a learning curve ([LobeHub Changelog](https://lobehub.com/changelog)).

### 3.11 OpenRouter (as a *sponsoring* provider for consumer apps)
OpenRouter's pitch is decisive for consumer BYOK design: "One API key. One billing system. One endpoint…instead of five remotes for five streaming services, you get one that controls everything" ([The Neuron](https://www.theneuron.ai/explainer-articles/one-api-key-to-rule-them-all-how-openrouter-lets-you-use-every-ai-model-without-the-headache/)). For a non-developer target audience, *recommending OpenRouter as the default BYOK path* can eliminate 3–5 separate provider signups. OpenRouter also now gives "1,000,000 BYOK requests per month for free" ([OpenRouter Announcement](https://openrouter.ai/announcements/1-million-free-byok-requests-per-month)).

### 3.12 ngrok AI Gateway (the "managed credits + BYOK" hybrid)
ngrok explicitly describes the shift away from pure BYOK-first: "most people coming to use the AI Gateway actually wanted…to start making requests without setting up provider accounts first…it's a lot to ask before someone's made their first request. So we built that" — they added prepaid credits while keeping BYOK free ([ngrok](https://ngrok.com/blog/ai-gateway-api-keys-credits)). Evidence that the industry is converging on hybrid models.

### 3.13 Chrome extension consumer examples: Monica, Merlin, Voilà, HARPA, Sider, MaxAI
These extensions made a deliberate decision most do *not* require a user-supplied key by default. Monica: "getting started with Monica AI was refreshingly easy. I grabbed it from the Chrome Web Store, hit 'Add to Chrome,' and signed in using my Google account…No onboarding tutorials, no drawn-out setup process. It was ready to go in under two minutes" ([Fritz](https://fritz.ai/monica-ai-review/)). Their FAQ: "Do I need a GPT/OpenAI account? No" ([Monica Chrome Web Store](https://chromewebstore.google.com/detail/monica-all-in-one-ai-assi/ofpnmcalabcbjgholdjcjblkibolbppb?hl=en)). Voilà is the most relevant example for a Chrome extension adding optional BYOK: they run their own subscription tiers but include "Use Voilà with your own OpenAI API key and get all the features of our Ultimate plan at a discounted price" ([Voilà BYOK](https://www.getvoila.ai/bring-your-own-key)). This "free/subscription by default, BYOK as a power-user option" is the dominant pattern for consumer Chrome extensions.

### 3.14 Neuropilot (a Chrome extension with a multi-step install flow — structurally similar to what you're building)
Neuropilot's welcome.tsx opens automatically on install, uses Plasmo storage to persist progress, and guides users through 5 steps: Introduction → Configure Flags → Download Model → User Info → Complete, with **resume behavior**: "This allows users to close the onboarding tab and resume later without losing progress" ([DeepWiki Neuropilot](https://deepwiki.com/sandipndev/neuropilot/2.2-onboarding-flow)). This is a proven template.

---

## 4. Progressive Onboarding: Value Before Keys

### 4.1 The "aha moment before signup" principle
Userpilot's case studies show top products deliberately move the aha moment *before* any setup: Stripo "provides users with the Aha! Moment before they've even signed up" with a no-signup demo on the homepage ([Userpilot](https://userpilot.com/blog/aha-moment-marketing-tool/)). For a jokes/advice extension, the equivalent is to generate sample jokes/advice about a well-known sample page (or the store page) using a server-hosted free tier or canned outputs *before* asking for any key. A related case study: a B2B SaaS moved from "no examples or drafts to guide them" to "integrated AI directly into the CMS to auto-draft listings and descriptions as soon as users signed up," driving a 35% increase in paid conversions ([SaaS Fractional CPO](https://saasfractionalcpo.com/case-studies/saas-ai-onboarding-optimization/)).

### 4.2 The four viable "pre-key" strategies
1. **Time-limited free credits via your own server-side key**, like Raycast's limited free messages ([Raycast](https://www.raycast.com/core-features/ai)), Cursor's 14-day Pro trial with 250 uses and no credit card ([daily.dev](https://daily.dev/blog/setup-cursor-first-time)), and Kilo Code's "$20 in credits for new users" ([Morph](https://www.morphllm.com/comparisons/kilo-code-vs-cline)). Lets the user laugh at the first joke within seconds.
2. **Free local/built-in model** like AnythingLLM's bundled Gemma/Llama ([DEV Community](https://dev.to/samder/getting-started-with-local-llms-using-anythingllm-47gl)). Not practical for Chrome extensions (too large), but a hosted free tier is the web equivalent.
3. **Free tier provider as the recommended default**, leveraging Gemini's genuine free tier of 15 RPM / 1,500 RPD on Flash models ([Restack](https://www.restack.io/p/subscription-free-ai-development-tools-answer-free-ai-services-cat-ai); [FindSkill](https://findskill.ai/blog/gemini-api-pricing-guide/)). For consumer use, Gemini Flash-Lite is "25x cheaper than Claude Sonnet and 5x cheaper than OpenAI's GPT-5.4" and is viable for low-traffic consumer apps ([FindSkill](https://findskill.ai/blog/gemini-api-pricing-guide/)).
4. **Deferred/just-in-time key entry**: don't ask for the key until the user triggers the first action that needs it. Factory CLI takes this approach for its custom-model path ([Factory](https://docs.factory.ai/cli/byok/overview)).

### 4.3 Default-provider recommendation (don't make users choose 5 providers)
A defining anti-pattern in products like LibreChat and Jan is forcing the user to stare at a grid of 10+ providers on first run. The best consumer-friendly alternative is the Obsidian Copilot approach: make **OpenRouter the default recommendation** — "the fastest path uses OpenRouter, which is the plugin's default provider out of the box" ([DeepWiki Obsidian Copilot](https://deepwiki.com/logancyang/obsidian-copilot/2-getting-started)). One key = access to GPT, Claude, Gemini, Llama, etc. ([The Neuron](https://www.theneuron.ai/explainer-articles/one-api-key-to-rule-them-all-how-openrouter-lets-you-use-every-ai-model-without-the-headache/)).

---

## 5. Technical/UX Patterns for API Key Entry

### 5.1 Always validate the key inline, before the user leaves the screen
Vercel's AI Gateway UI is representative of best practice: "Click Test Key to validate and add your credentials" — the button is adjacent to the input and produces a green checkmark on success or a specific error message on failure ([Vercel](https://vercel.com/docs/ai-gateway/authentication-and-byok/byok)). ZenMux's Obsidian Copilot plugin config also has an explicit "Test button to verify connectivity: If configured correctly, you will see a success message. If the connection fails, see the Troubleshooting section" ([ZenMux](https://docs.zenmux.ai/best-practices/obsidian.html)). OpenRouter's BYOK docs further enumerate the failure codes the UI should translate into plain English: 401 = "Your API key is invalid or has been revoked. Verify your key in your provider's console"; 402/insufficient quota = "Verify billing settings…check your usage dashboard" ([OpenRouter BYOK](https://openrouter.ai/docs/guides/overview/auth/byok); [Obsidian Copilot](https://github.com/logancyang/obsidian-copilot)).

### 5.2 Deep-link to the exact key-creation page
Provider-specific deep links (verified from multiple product docs):
- **OpenAI**: `https://platform.openai.com/account/api-keys` (key creation page) and `https://platform.openai.com/account/billing/overview` (prepaid setup — mandatory) ([TypingMind](https://docs.typingmind.com/chat-models-settings/get-openai-api-key); [Gabors Data](https://gabors-data-analysis.com/ai-course/week06/assets/get-ai-api-key.html)).
- **Anthropic**: `https://console.anthropic.com` → Key icon in bottom-left → "API Keys" → "+ Create Key" ([Promptitude](https://help.promptitude.io/en/articles/11166436-how-to-get-your-api-key-for-anthropic); [AI Content Labs](https://docs.aicontentlabs.com/articles/anthropic-api-key/)).
- **Google Gemini**: Google AI Studio at `https://aistudio.google.com` (Free Tier available) ([Google AI Docs](https://ai.google.dev/gemini-api/docs/billing); [FindSkill](https://findskill.ai/blog/gemini-api-pricing-guide/)).
- **OpenRouter**: `https://openrouter.ai/keys` ([Real Python](https://realpython.com/openrouter-api/)).

Open each provider's key page in a new tab via a labeled button ("Get key from OpenAI ↗"), not a text link. Every successful BYOK product does this ([BoltAI](https://docs.boltai.com/docs/guides/how-to-create-an-openai-api-key); [TypingMind](https://docs.typingmind.com/chat-models-settings/get-openai-api-key); [Pickaxe](https://pickaxe.co/post/how-to-get-your-openai-api-key-a-step-by-step-guide); [Clipboard AI](https://www.clipboard-ai.com/blog/how-to-create-openai-api-key)).

### 5.3 Provider-card UI, not a dropdown
The consistent pattern across Chatbox ([Chatbox](https://docs.chatboxai.app/en/guides/providers)), LobeHub ([LobeHub](https://lobehub.com/docs/usage/start)), Msty ([Msty Docs](https://docs.msty.app/getting-started/onboarding)), and TypingMind ([TypingMind](https://docs.typingmind.com/manage-and-connect-ai-models/set-up-api-keys)) is a grid of visual provider cards with each brand's logo, a one-line description, a pricing hint, and a gear icon to configure. Users scan logos, not dropdown text. LobeHub's own open-source icon library (`@lobehub/icons`) standardizes this across AIGC apps.

### 5.4 Step-by-step instructions with screenshots (video if possible)
Obsidian Copilot directly embeds a short video in its settings page: "▶️ Watch the 'AI Model Setup' video: AI Model Setup (API Key)" ([GitHub Obsidian Copilot](https://github.com/logancyang/obsidian-copilot)). TypingMind, BoltAI, Pickaxe, and ClipboardAI all ship written walkthroughs with screenshots of every click on the provider side ([TypingMind](https://docs.typingmind.com/chat-models-settings/get-openai-api-key); [BoltAI](https://docs.boltai.com/docs/guides/how-to-create-an-openai-api-key); [Pickaxe](https://pickaxe.co/post/how-to-get-your-openai-api-key-a-step-by-step-guide); [ClipboardAI](https://www.clipboard-ai.com/blog/how-to-create-openai-api-key)). Mozilla's extension-onboarding guidance adds the accessibility rule: "If you do create a video, provide closed captioning or a transcript" ([MDN Onboarding](https://developer.mozilla.org/pl/docs/Mozilla/Add-ons/WebExtensions/onboarding_upboarding_offboarding_best_practices)).

### 5.5 Surface the billing-prepayment gotcha explicitly
The single most common BYOK failure is "I pasted the key but it doesn't work." In every case it's because the user hasn't funded the provider account. TypingMind explicitly tells users: "Remember to enable Auto-recharge to avoid your experience with the app being delayed due to low OpenAI credit" ([TypingMind](https://docs.typingmind.com/chat-models-settings/get-openai-api-key)). Obsidian Copilot's troubleshooting says to "verify your billing settings in your OpenAI dashboard, add a payment method if one isn't already on file, check your usage dashboard for any quota or limit warnings" ([GitHub Obsidian Copilot](https://github.com/logancyang/obsidian-copilot)). Your inline-validation error copy should translate a 402 into: *"Your OpenAI account has no credit. Click here to add $5 of credit, then test your key again."*

---

## 6. Security & Trust-Building Messaging for a Chrome Extension

### 6.1 Where to store keys in a Chrome extension
Chrome offers `chrome.storage.local` (10 MB, cleared on uninstall, not synced) and `chrome.storage.sync` (100 KB total, 8 KB per item, cross-device) ([Chrome Developers](https://developer.chrome.com/docs/extensions/reference/api/storage); [Mellowtel](https://www.mellowtel.com/blog/chrome-extension-storage-api-guide)). For API keys:

- **Use `storage.local`, not `storage.sync`** — sync is unencrypted, travels through Google servers, and has small quotas. Local is the accepted norm.
- Consider encrypting-at-rest with a derived key (like the open-source KeyChain extension, which uses "AES-GCM encryption" and stores keys "as ciphertext in IndexedDB" ([GitHub KeyChain](https://github.com/jwjoel/KeyChain))), or follow BoltAI's model of optional user-passphrase encryption ([BoltAI Blog](https://docs.boltai.com/blog/how-boltai-handles-your-api-keys)).
- There is a real threat: Obsidian Security documented a Chrome extension impersonating ChatGPT that stole ~459 OpenAI keys from ~10,000 installs — "once the extension is installed, the user is prompted to enter their OpenAI API key…the extension validates the key with ChatGPT, before storing it in local storage" ([Obsidian Security](https://www.obsidiansecurity.com/blog/small-tools-big-risk-when-browser-extensions-start-stealing-api-keys)). Communicating that your extension isn't this should be a first-class onboarding goal.

### 6.2 Trust-building copy patterns
- **"Keys never leave your browser"** — SurfMind's messaging is a good template: "website content processing happens in your browser…Nothing gets sent anywhere until you explicitly make an AI request, and even then, only the context you've selected goes to the provider. There's no background scraping. No passive data collection. No silent uploading of your browsing activity. Conversation history stays local too" ([SurfMind](https://surfmind.ai/blog/privacy-first-ai-browser-guide)).
- **"Direct line to the provider"** — "Your prompts are sent directly to OpenAI or your AI Service of choice" ([BoltAI Features](https://help.boltai.com/articles/2306606-features)); "your data? That travels on a direct line between you and the provider you chose" ([SurfMind](https://surfmind.ai/blog/privacy-first-ai-browser-guide)).
- **"Open-source / auditable"** if applicable — Chatbox emphasizes "Privacy-First: All conversation data stored locally using libsql/SQLite" and open-source GPLv3 status ([DeepWiki Chatbox](https://deepwiki.com/chatboxai/chatbox)).
- **Include a revocation reminder** — tell the user they can revoke the key at the provider at any moment; this is BYOK's ultimate trust move.

### 6.3 Permissions justification in the Chrome Web Store listing + post-install tab
Chrome's reviewer guidelines demand "an extension must have a single purpose that is narrow and easy to understand" and each requested permission must have a written justification in the store listing ([Chrome Developers](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy); [Chrome Developers](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)). For a tab-observing extension, `activeTab` is strongly preferred over `<all_urls>`: "activeTab grants an extension temporary host permission for the current tab in response to a user invocation. Unlike host permissions, activeTab does not trigger any warnings" ([Chrome Developers](https://developer.chrome.com/docs/extensions/reference/api/tabs)). This is a material trust and install-conversion difference: a "read and change all your data on all websites" warning is a known fear trigger ([Toolworthy](https://www.toolworthy.ai/blog/best-ai-chrome-extensions)).

Implementation pattern (Chrome and Firefox, canonical): open a dedicated welcome tab on first install, scoped to the install event only:
```javascript
chrome.runtime.onInstalled.addListener(({reason}) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: "onboarding.html" });
  }
});
```
This example "doesn't require any permissions" ([Chrome Developers](https://developer.chrome.com/docs/extensions/reference/api/tabs)) and is used by ColorZilla, Honey, Wappalyzer, and Glitch ([DEV Community](https://dev.to/avigoldman/open-a-new-tab-when-your-browser-extension-is-installed-7h7)).

---

## 7. The "Listening/Observing" Onboarding Challenge

Because the extension observes current-tab content, users will form beliefs about privacy in the first 60 seconds that are very hard to reverse. Two threats to head off:

1. **Covert-capture fear**: a demonstration of how easy it is to silently capture page content is widely publicized ([Matt Frisbie](https://mattfrisbie.substack.com/p/spy-chrome-extension)). Users know extensions can do this.
2. **Legitimate concerns about extension fingerprinting**: extensions leak presence clues and should be designed to limit this ([Malwarebytes](https://www.malwarebytes.com/blog/inside-malwarebytes/2026/04/your-extensions-leak-clues-about-you-so-we-made-sure-browser-guard-doesnt)).

Design patterns that address the fear:

- **Explicit invocation model**: use a global shortcut or icon-click (activeTab) so the user sees every read, rather than continuous background observation. This is what BoltAI does on macOS — "Global shortcut. Open BoltAI instantly over any app with a single keystroke" ([BoltAI](https://boltai.com/)).
- **Per-site toggles or domain opt-in**: ProtoConsent's model of "per-site profiles and purpose toggles" is a consumer-friendly pattern to adopt ([GitHub ProtoConsent](https://github.com/ProtoConsent/ProtoConsent)).
- **A visible "reading your page" indicator** whenever the extension reads content, so reading is never invisible.
- **An explicit consent card** in onboarding explaining: "When you ask for a joke, we send the current page's title and text to your chosen LLM. Your API key and browser history stay on your device. We don't read anything until you press [shortcut]/click the icon." This directly mirrors SurfMind's trust copy ([SurfMind](https://surfmind.ai/blog/privacy-first-ai-browser-guide)).

---

## 8. Handling Cost / Pricing Anxiety

### 8.1 Pre-empt sticker shock with concrete numbers
The industry norm is not to hide costs. Chatsistant publishes token-budget tables per OpenAI model with dollar-per-day estimates ([Chatsistant](https://docs.chatsistant.com/byok-pricing-guide)). Scribelet translates usage into plain language: "50 prompts a day averaging 500 tokens each…that's about 750,000 tokens per month" ([Scribelet](https://scribelet.app/blog/byok-ai)). Your onboarding should show something like *"Typical usage: ~50 jokes per day = about $0.08/month on Gemini Flash-Lite or $1.50/month on GPT-4o-mini."* FindSkill's 2026 figures for reference: Gemini Flash-Lite is $0.10 per million input tokens ([FindSkill](https://findskill.ai/blog/gemini-api-pricing-guide/)).

### 8.2 Build in spend controls / budget alerts
Rilna's guidance: "set provider-side limits or alerts and treat your first week as a calibration period" ([Rilna](https://www.rilna.net/blog/bring-your-own-api-key-byok-tools-guide-examples)). Link the user to each provider's spend-limit page during onboarding. Puter's Anthropic tutorial frames this as a best practice: "Anthropic charges per token, and pricing varies by model. Set a monthly spending limit here to avoid surprises" ([Puter](https://developer.puter.com/tutorials/how-to-get-anthropic-api-key/)). Showing an in-app counter of approximate dollars spent this month is a documented anxiety-reducer ([Macaron](https://macaron.im/blog/openclaw-cost-guide)).

### 8.3 Explain *why* BYOK is cheaper for this use-case
Use HeyHelp's framing verbatim or in spirit: "Use three apps. Get the same GPT-4 under the hood. Pay three times. That didn't feel right" ([HeyHelp](https://www.heyhelp.ai/byok/)). Combined with a "typical jokes user spends under $1/month" line, this flips the BYOK friction into a value proposition.

---

## 9. Multi-Provider UX: Default, Fallback, Per-Task

### 9.1 Don't force multi-provider setup; make it a power-user drawer
Empirically, none of the consumer BYOK products force more than one provider. Raycast supports four custom providers but defaults to hosted ([Raycast](https://manual.raycast.com/ai)). Msty's onboarding is one-provider-pick-and-go ([Msty Docs](https://docs.msty.app/getting-started/onboarding)). Zed: "To use AI in Zed, you need to have **at least one** large language model provider set up" ([Zed](https://zed.dev/docs/ai/llm-providers)).

### 9.2 Default/fallback model selection
Two patterns in the wild:
- **OpenRouter auto-routing** via the special model ID `openrouter/auto`: "OpenRouter automatically selects the optimal model based on performance, cost, or speed" ([Codecademy](https://www.codecademy.com/article/what-is-openrouter); [OpenRouter Provider Routing](https://openrouter.ai/docs/guides/routing/provider-selection)). If you use OpenRouter as your default, get auto-routing for free.
- **Per-task model preferences** — LobeHub: "Each Agent can have its own default model. Your code reviewer uses one model while your copywriter uses another, all running automatically without you making a choice each time" ([LobeHub Docs](https://lobehub.com/docs/usage/start)). AnythingLLM: "you can optionally change the model and provider per workspace" ([AnythingLLM](https://docs.useanything.com/agent/setup)). TypingMind offers "Custom Profiles with Custom API keys" — work profile with work key, personal with personal key ([TypingMind](https://docs.typingmind.com/system-prompt/custom-profiles-with-custom-api-keys)). For your product, a sensible default is Jokes=fast cheap model (Gemini Flash or Haiku), Advice=stronger reasoning (GPT-4o-mini, Claude Sonnet), user-overridable.

### 9.3 Friendly model labels, not model IDs
Consumer UX research is unambiguous: model names like "gpt-4-turbo-2024-04-09" are hostile to non-developers. Adam Berke's product essay on ChatGPT's own dropdown argues for "user-centric labeling of the models. The people who care about the technical details will consume that content elsewhere. Add a 'let ChatGPT choose' option" ([Adam Berke](https://www.adamberke.com/thoughts/2025/6/25/product-thinking-chatgpts-model-selection-dropdown)). Palantir's Model Selector exposes "four performance indicators (Model Class, Cost, Speed, and Availability)" alongside model names ([Palantir](https://community.palantir.com/t/introducing-model-selector-enhancing-your-model-selection-experience/2972)). For a jokes/advice extension, use labels like "Fast & cheap," "Best quality," or brand names like "Claude Sonnet" with pricing tooltips.

---

## 10. Chrome-Extension-Specific Tactics

### 10.1 Post-install flow timing
Critical MDN research finding: "The first few minutes after someone installs your extension can be critical to its success" but "protracted setup requirements can have a…negative impact on people's perception" ([MDN](https://developer.mozilla.org/pl/docs/Mozilla/Add-ons/WebExtensions/onboarding_upboarding_offboarding_best_practices)). The synthesis: open ONE welcome tab that (a) confirms identity/logo, (b) shows one immediate value demo, (c) walks through the single smallest setup needed (pin icon, one key), (d) links to deeper help. Don't build a 10-screen wizard.

### 10.2 Pin-the-icon prompt
Most users don't know how to pin extensions, which dramatically reduces daily usage — "a simple visual guide dramatically increases daily usage" ([ExtensionBooster](https://extensionbooster.com/blog/best-practices-build-browser-extension/)). Include an animated GIF or arrow pointing to the Chrome puzzle icon during onboarding.

### 10.3 Popup vs. side panel vs. options page
For BYOK configuration specifically, Chrome's side panel is the best-fit surface:
- **Popup** is constrained (~400×600, closes on focus loss) — bad for key entry forms and step-by-step guides.
- **Side panel (`chrome.sidePanel`)** is persistent across navigation, much roomier, and supports the same Chrome APIs as the popup ([Chrome Developers](https://developer.chrome.com/docs/extensions/reference/api/sidePanel); [Mellowtel](https://mellowtel.com/blog/how-to-open-chrome-extensions-side-panel-a-comprehensive-guide)). However, Chrome recently changed side panel UX: "We have also removed the global side panel icon, which could be used to access any side panel" — extensions now must provide an explicit icon/pin to reopen the side panel ([Chromium Groups](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/5PQyHPYQuXY/m/ZbsHqqTlAgAJ)).
- **Full-page options/welcome tab** is the right surface for the one-time initial onboarding (per the Chrome dev/Mozilla pattern).

Recommended split: **Welcome tab** for first-run onboarding (one big screen), **Side panel** for the ongoing joke/advice UI, **Options page** (reachable from the side panel) for managing providers and keys after setup.

### 10.4 Permissions warnings strategy (Manifest V3)
To avoid the scary "Read and change your data on all websites" warning:
- Use `activeTab` instead of `<all_urls>` wherever possible — activeTab "grants temporary access…without any warnings" ([Chrome Developers](https://developer.chrome.com/docs/extensions/mv2/permission-warnings)).
- Declare invasive permissions in `optional_permissions` and request them at runtime with an in-context explanation, e.g., "This extension needs access to *{site.com}* to understand what's on the page and generate advice. Allow?"
- Your Chrome Web Store privacy-practices tab must give a one-line justification for every permission ([Chrome Developers](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)).

---

## 11. Metrics, Drop-Off Points, and A/B Patterns

Published BYOK-specific conversion benchmarks are scarce, but adjacent data gives useful signposts:
- Installers who don't receive onboarding abandon at up to 80% ([ExtensionBooster](https://extensionbooster.com/blog/best-practices-build-browser-extension/)).
- "Companies with the shortest onboarding time are seeing 62% better free-to-paid conversion rates" ([Saltfish](https://www.saltfish.ai/blog/why-onboarding-is-the-strongest-lever-for-activation-rate)).
- Appcues found segmented (not generic) onboarding improves activation rates by 30–45% vs. generic flows ([SaaSFactor](https://www.saasfactor.co/blogs/the-science-of-saas-onboarding-a-comprehensive-framework-for-reducing-friction-improving-activation-and-preventing-churn)).
- Moldstud found "clear call-to-action buttons during the initial setup phase of your add-on can increase user interaction rates by up to 30%" and interactive tutorials make users "70% more likely to engage" ([Moldstud](https://moldstud.com/articles/p-best-practices-for-user-onboarding-in-a-chrome-extension-freemium-model-maximize-engagement-and-retention)). Treat these as directional, not authoritative — they are marketing-oriented aggregations.
- 82% of free-trial starts happen on the day of install for subscription apps ([Airbridge](https://www.airbridge.io/en/blog/freemium-vs-free-trial-difference)). This implies "don't defer the value demo even by a day."

Typical BYOK-onboarding drop-off points to instrument:
1. Install → welcome tab opened (Chrome does not guarantee this lands; ~5–10% lose the tab immediately).
2. Welcome tab → "Try it free" demo completed (should be >80% if the demo is truly zero-friction).
3. Demo → "Get my API key" clicked.
4. Provider signup (outside your funnel — biggest black hole; use a resume-able wizard like Neuropilot's so users can come back) ([DeepWiki Neuropilot](https://deepwiki.com/sandipndev/neuropilot/2.2-onboarding-flow)).
5. Key pasted → inline validation passed.
6. First real-content joke generated.

Instrument each as a step event (OneUptime's guidance) to find the worst step-duration×dropoff combo ([OneUptime](https://oneuptime.com/blog/post/2026-02-06-saas-onboarding-funnel-metrics-opentelemetry/view)).

---

## 12. Recommended Onboarding Flow for Your Extension

Synthesizing everything above into a concrete flow for the jokes/advice Chrome extension. This is designed for the median consumer (not a developer), with escape hatches for power users.

**Pre-install (Chrome Web Store listing):**
- Short (<30 s) screencast showing the extension generating a joke about a real webpage in real time ([Chrome Developers Best Practices](https://developer.chrome.com/docs/webstore/best-practices)).
- One-line permissions justification for each permission; avoid `<all_urls>` wherever possible.

**Step 0 — Install:** `chrome.runtime.onInstalled` opens `welcome.html` in a new tab (canonical pattern) ([Chrome Developers](https://developer.chrome.com/docs/extensions/reference/api/tabs)).

**Step 1 — Value-first demo (0 keys required):**
- Big "Tell me a joke about this page" button that operates on a pre-loaded sample page (a fake news article or a sample browser tab). Use a server-side free-tier quota (e.g., 5 jokes/day on your own Gemini key) to deliver real AI output without the user providing anything. This is the Raycast + Cursor pattern ([Raycast](https://www.raycast.com/core-features/ai); [daily.dev](https://daily.dev/blog/setup-cursor-first-time)).
- An ambient "pin the extension" animation while they're reading the joke ([ExtensionBooster](https://extensionbooster.com/blog/best-practices-build-browser-extension/)).

**Step 2 — Trust card (before any key question):**
- Three bullets explaining (a) keys stay in your browser, never on our server ([BoltAI](https://help.boltai.com/articles/2306606-features); [SurfMind](https://surfmind.ai/blog/privacy-first-ai-browser-guide)); (b) we only read a tab when *you* invoke us; (c) you can revoke the key at the provider at any time.
- Links to the open-source repo (if applicable) and the privacy policy.

**Step 3 — The choice, with strong recommended defaults:**
Present three cards, in order of recommended path:
1. **"Use free credits"** (recommended for most — continue with N free requests/day from us).
2. **"Bring your own API key — OpenRouter (easiest, one key for all models)"** ([The Neuron](https://www.theneuron.ai/explainer-articles/one-api-key-to-rule-them-all-how-openrouter-lets-you-use-every-ai-model-without-the-headache/); [OpenRouter BYOK](https://openrouter.ai/announcements/1-million-free-byok-requests-per-month)).
3. **"I already have a key — OpenAI, Anthropic, or Gemini"** (expands into provider cards).

**Step 4 — Guided key creation (if BYOK chosen):**
- Big "Open OpenRouter.ai in a new tab" button that deep-links to the key page ([Real Python](https://realpython.com/openrouter-api/)).
- A live-shrunk screenshot walkthrough in the same page: "1. Sign up. 2. Click Keys. 3. Click Create Key. 4. Paste below." Matching the BoltAI / Pickaxe / ClipboardAI walkthrough patterns ([BoltAI](https://docs.boltai.com/docs/guides/how-to-create-an-openai-api-key); [Pickaxe](https://pickaxe.co/post/how-to-get-your-openai-api-key-a-step-by-step-guide); [ClipboardAI](https://www.clipboard-ai.com/blog/how-to-create-openai-api-key)).
- Explicit prepaid-billing callout if OpenAI or Anthropic: *"You'll also need to add at least $5 of credit at your provider for the key to work. Here's the link."* ([TypingMind](https://docs.typingmind.com/chat-models-settings/get-openai-api-key); [Promptitude](https://help.promptitude.io/en/articles/11166436-how-to-get-your-api-key-for-anthropic)).

**Step 5 — Inline validation:**
- User pastes key → UI fires a tiny "hello" completion in the background → green checkmark and model list populated, OR a plain-English error: *"This key looks invalid. Double-check the copy-paste, or if you just created it, wait 30 seconds and try again."* Pattern from Vercel + OpenRouter error-code mapping ([Vercel](https://vercel.com/docs/ai-gateway/authentication-and-byok/byok); [OpenRouter BYOK](https://openrouter.ai/docs/guides/overview/auth/byok)).
- Store the key in `chrome.storage.local`, encrypted at rest. Consider optional user-passphrase like BoltAI ([BoltAI Blog](https://docs.boltai.com/blog/how-boltai-handles-your-api-keys)).

**Step 6 — Cost context:**
- One sentence: *"Typical users spend under $1/month on jokes. We'll show you a running estimate every time you generate one."* Link to the provider's budget-alert page ([Puter](https://developer.puter.com/tutorials/how-to-get-anthropic-api-key/)).

**Step 7 — First real joke:**
- Immediately open a real tab (e.g., the Chrome new tab or a suggested test page) and generate a joke, with a celebratory animation. This is the "aha" moment ([Userpilot](https://userpilot.com/blog/aha-moment/)).
- Brief hint: "Click the extension icon or press ⌘+J on any page to get a joke or advice. Tell us which you want in the side panel."

**Step 8 — Defer everything else:**
- Do NOT ask for multiple providers, per-task model preferences, or advanced settings now. Surface these later in a Settings/Options page, visible from the side panel.
- Power users can jump to Options directly from Step 3 via a "Configure manually" link, mirroring Raycast's "advanced" toggle ([Raycast Changelog](https://www.raycast.com/changelog/macos)) and Kodus's "Configure manually" wizard ([Kodus](https://docs.kodus.io/how_to_use/en/byok)).

Total target time to first generated joke: **under 60 seconds without a key, under 3 minutes with a brand-new OpenRouter key**.

---

## 13. Anti-Patterns to Avoid (Catalogued from Competitor Failures)

1. **Asking for a key before showing any value.** Mozilla research directly ties this to uninstall intent ([MDN](https://developer.mozilla.org/pl/docs/Mozilla/Add-ons/WebExtensions/onboarding_upboarding_offboarding_best_practices)).
2. **Dumping a 10+ provider grid on the user with no default.** LibreChat, Jan, and early LobeHub versions all suffer from this; LobeHub explicitly added a "guided onboarding path" in 2026 because of it ([LobeHub Changelog](https://lobehub.com/changelog)).
3. **Not validating the key inline.** Users paste, click save, go use the product, get a cryptic error 10 seconds later, and blame you.
4. **Hiding the prepaid-billing requirement.** The single most common BYOK support ticket. Every good tutorial surfaces it; every bad one omits it ([TypingMind](https://docs.typingmind.com/chat-models-settings/get-openai-api-key)).
5. **Requesting `<all_urls>` at install time.** Triggers the worst permission warning Chrome has and is a documented fear trigger ([Toolworthy](https://www.toolworthy.ai/blog/best-ai-chrome-extensions); [Chrome Developers](https://developer.chrome.com/docs/extensions/mv2/permission-warnings)).
6. **Storing keys in `chrome.storage.sync`.** Unencrypted, sync-prone, and limits mean this is the wrong primitive.
7. **Exposing model IDs in the main UI.** Non-developers don't want to pick between "claude-3-5-sonnet-20241022" and "claude-3-5-haiku-20241022." Use friendly labels with cost tooltips ([Adam Berke](https://www.adamberke.com/thoughts/2025/6/25/product-thinking-chatgpts-model-selection-dropdown)).
8. **Making the onboarding page non-resumable.** Neuropilot's Plasmo-storage resume pattern is the counter-example to copy ([DeepWiki Neuropilot](https://deepwiki.com/sandipndev/neuropilot/2.2-onboarding-flow)).
9. **Silently observing the page.** The "Always observing" model without a visible indicator destroys trust; use activeTab + explicit invocation.
10. **Post-install upgrade flows that ask for permissions not originally granted.** Chrome will disable the extension until the user re-accepts, catastrophic for retention ([Chrome Developers](https://developer.chrome.com/docs/extensions/mv2/permission-warnings)). Plan to use `optional_permissions` for anything you might add later.
11. **Forgetting i18n.** Target a wide audience? LobeHub's `@lobehub/ui` ships with I18nProvider resources for form and hotkey messages out of the box and supports multi-language from day one ([GitHub lobe-ui](https://github.com/lobehub/lobe-ui)).
12. **Advertising inside the onboarding page.** Mozilla flags this: "Don't include advertising on your post-install page. Ads can degrade people's trust" ([Firefox Extension Workshop](https://extensionworkshop.com/documentation/develop/onboard-upboard-offboard-users/)).

---

## 14. Edge Cases

**The user has zero API keys and doesn't want to sign up for a provider.** Serve them from your free tier; be transparent that it's limited. This is exactly how Raycast, Monica, and Merlin operate on Day 1 ([Raycast](https://www.raycast.com/core-features/ai); [Fritz](https://fritz.ai/monica-ai-review/)).

**The user only has a Gemini API key (free-tier).** Treat this as the "blessed" BYOK path for consumers. Gemini Flash-Lite's free tier is genuinely consumer-viable at 15 RPM / 1,500 RPD ([Restack](https://www.restack.io/p/subscription-free-ai-development-tools-answer-free-ai-services-cat-ai)), and the new April 2026 Gemini pricing changes only affect Pro models, not Flash ([FindSkill](https://findskill.ai/blog/gemini-api-pricing-guide/)). Display a green "free tier" badge on the Gemini card. Be aware: the free tier means Google may use prompts to improve its products ([Spur](https://www.spurnow.com/en/blogs/is-gemini-api-free/); [LaoZhang AI](https://blog.laozhang.ai/en/posts/gemini-api-free-tier/)) — disclose this.

**The power user wants to configure every provider.** Provide a single "Advanced setup" link on Step 3 that opens the full Options page with the provider grid (Chatbox / LobeHub / Msty style). Don't gate this behind the main flow.

**Users running a local model (Ollama).** Support `localhost:11434` as an "OpenAI-compatible custom provider" (Jan, Chatbox, AnythingLLM, Raycast, Msty all do this) ([Raycast Changelog](https://www.raycast.com/changelog/macos/1-99-0); [AnythingLLM](https://betterstack.com/community/guides/ai/anythingllm-local-llm/); [Chatbox Config](https://docs.chatboxai.app/en/guides/providers)). Low priority for a *consumer* Chrome extension, but a free power-user feature.

**Enterprise/security-conscious users.** Offer the optional-passphrase encryption pattern from BoltAI/TypingMind ([BoltAI Blog](https://docs.boltai.com/blog/how-boltai-handles-your-api-keys); [TypingMind FAQ](https://docs.typingmind.com/general-faqs)) and document exactly which Chrome storage API is used.

**Users who accidentally exposed their key.** Add a "Revoke + replace" flow in Settings with deep links to each provider's key-management console, following OpenAI/Anthropic dashboards ([Gabors Data](https://gabors-data-analysis.com/ai-course/week06/assets/get-ai-api-key.html); [Promptitude](https://help.promptitude.io/en/articles/11166436-how-to-get-your-api-key-for-anthropic)).

**402 / insufficient quota errors at runtime.** Translate into "Your OpenAI account is out of credit. Add more here → [deep link]" rather than raw API errors — the Obsidian Copilot troubleshooting path is a template ([GitHub Obsidian Copilot](https://github.com/logancyang/obsidian-copilot)).

---

## 15. One-Page Cheat Sheet

1. **Default to value-before-key**: N free jokes from your server-side free tier, no signup.
2. **Default BYOK path = OpenRouter**: one key, all models, 1M free requests/month ([OpenRouter](https://openrouter.ai/announcements/1-million-free-byok-requests-per-month)).
3. **Single welcome tab** on install via `chrome.runtime.onInstalled`; resume-able via `chrome.storage.local`.
4. **Provider cards, not dropdowns**, with logos + one-line cost hint.
5. **Deep-link to provider key pages**, include screenshot walkthroughs, always warn about prepaid billing (OpenAI/Anthropic).
6. **Inline validation** with a test request; plain-English error mapping for 401/402/429.
7. **Store keys in `storage.local`**, encrypted, with optional user passphrase; never `storage.sync`.
8. **activeTab > `<all_urls>`**; use `optional_permissions` for anything added later.
9. **Friendly model names** (Fast/Cheap vs. Best Quality), "let it choose" default, per-task overrides as a power-user feature.
10. **Show running cost estimate and link to provider budget alerts** to kill billing anxiety.
11. **Explicit-invocation UX** for the observing feature (shortcut or icon click); visible indicator every time content is read.
12. **Instrument a 6-step funnel** (install → demo → key-get → key-paste → validate → first real output) and A/B test provider card order.

BYOK is fundamentally a trust and patience product problem. The products that win (Raycast, BoltAI, Msty, TypingMind, Cursor, and, on the pure-consumer side, Monica's subscription-first-but-BYOK-optional model) all understand that the *first minute matters more than the first five*, that a working default beats a well-labeled choice, and that the word "key" should appear only after the user has already laughed.