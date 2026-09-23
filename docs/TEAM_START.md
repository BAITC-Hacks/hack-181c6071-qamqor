# Команды старта для команды

Каждый работает в собственном локальном клоне официального repo.

Перед началом прочитать `docs/GIT_WORKFLOW.md`. В `main` напрямую не push; готовую работу участник отправляет своей веткой и создаёт Pull Request.

## Али

```powershell
git clone https://github.com/BAITC-Hacks/hack-181c6071-qamqor.git
cd hack-181c6071-qamqor
git switch feat/core
code .
```

Передать Codex содержимое `prompts/ALI.md`. Первый результат: запускаемый каркас, типы и CSV loader. Не ждать UI.

## Даурен

```powershell
git clone https://github.com/BAITC-Hacks/hack-181c6071-qamqor.git
cd hack-181c6071-qamqor
git switch feat/ui
code .
```

Передать Codex содержимое `prompts/DAUREN.md`. Пока Али делает каркас, подготовить компоненты формы и состояний без изменения общего API. После сообщения Али подтянуть его ветку.

## Димаш

```powershell
git clone https://github.com/BAITC-Hacks/hack-181c6071-qamqor.git
cd hack-181c6071-qamqor
git switch feat/ai-data
code .
```

Передать Codex содержимое `prompts/DIMASH.md`. Сразу начать проверку CSV, demo fixtures и тестовые ожидания без изменения зависимостей.

## Перед каждым push

```powershell
git branch --show-current
git status
git diff --check
git diff --cached
git push -u origin HEAD
```

`.env.local` не добавлять даже через `git add -f`. API-ключи не пересылать участникам: серверный ключ добавляет Али в Vercel, локальный ключ использует только его владелец.
