<script lang="ts">
  import { Check, Vote, LockKeyhole, Users, Scale } from 'lucide-svelte';
  import type { RoomView, PublicPoll } from '../../shared/types';
  import { locale } from '../lib/i18n';
  import { command, busy, connection } from '../lib/client';
  let { game, poll, gm = false }: { game: RoomView; poll: PublicPoll; gm?: boolean } = $props();
  let reason = $state(''), tieChoice = $state('');
  const t = (zh: string, en: string) => $locale === 'zh-CN' ? zh : en;
  const locked = $derived($busy || $connection !== 'live');
  const eligible = $derived(poll.eligible.includes(game.me));
  const total = $derived(Object.values(poll.counts ?? {}).reduce((a, b) => a + b, 0));
  const allVoted = $derived(poll.eligible.length > 0 && poll.voted.length === poll.eligible.length);
</script>
<section class="poll-panel" aria-label={poll.question[$locale]}>
  <div class="panel-heading"><span class="icon-well"><Vote size={20} /></span><div><h3>{poll.question[$locale]}</h3><p>{poll.status === 'open' ? t('独立选择，GM 结束投票后一起看结果。', 'Choose independently. Results are revealed when a GM closes the vote.') : poll.tied.length ? t('意见持平，先听听彼此的理由。', 'A tie. Hear each other’s reasoning first.') : poll.outcome ? t('团队已经做出决定。', 'The team has made a decision.') : t('投票已结束，本轮没有产生决定。', 'Voting is closed. No decision was made this round.')}</p></div><span class="pill">{poll.status === 'open' ? t('投票中', 'Voting') : poll.tied.length ? t('平票', 'Tied') : t('已结束', 'Closed')}</span></div>
  <div class="poll-options">{#each poll.options as option, i}
    <button class="vote-option" class:my-vote={poll.myVote === option.id} class:winner={poll.outcome === option.id} disabled={locked || poll.status !== 'open' || !eligible} onclick={() => command('vote', { pollId: poll.id, option: option.id })} aria-pressed={poll.myVote === option.id}>
      {#if poll.counts}<span class="vote-fill" style:width={`${total ? (poll.counts[option.id] / total) * 100 : 0}%`}></span>{/if}
      <span class="option-letter">{String.fromCharCode(65 + i)}</span><span class="option-label">{option.label[$locale]}</span>
      {#if poll.status === 'open'}{#if poll.myVote === option.id}<Check size={20} />{/if}{:else}<span class="vote-count">{poll.counts?.[option.id] ?? 0} {t('票', 'votes')}</span>{#if poll.outcome === option.id}<Check size={20} />{/if}{/if}
    </button>
  {/each}</div>
  <div class="poll-participation"><span><Users size={15} />{poll.voted.length} / {poll.eligible.length} {t('已投票', 'voted')}</span>{#if poll.status === 'open'}<span><LockKeyhole size={13} />{t('选择暂未公开', 'Choices are hidden')}</span>{/if}</div>
  <div class="voter-list">{#each poll.eligible as memberId}<span class:voted={poll.voted.includes(memberId)}>{#if poll.voted.includes(memberId)}<Check size={12} />{:else}<span class="waiting-dot"></span>{/if}{game.members.find(m => m.id === memberId)?.name}</span>{/each}</div>
  {#if poll.status === 'open' && !eligible}<p class="field-hint">{t('此轮名单已确定。主持人与观察者不投票，新加入的玩家从下一轮参与。', 'This round’s roster is fixed. GMs and observers do not vote; newly joined players participate next round.')}</p>{/if}
  {#if poll.status === 'open'}<p class="vote-status-hint" role="status">{allVoted ? t('全员已投票，等待 GM 结束。结束前仍可更改选项。', 'Everyone has voted. Waiting for a GM to close. Choices can still be changed.') : t('由 GM 结束投票；结束前可随时更改选项。', 'A GM closes the vote. You can change your choice until then.')}</p>{/if}
  {#if gm && poll.status === 'open'}
    <form onsubmit={(e) => { e.preventDefault(); command('close_vote', { pollId: poll.id, reason }); }}>
      <details class="gm-details"><summary>{t('结束说明（选填）', 'Closing note (optional)')}</summary><label for={`close-reason-${poll.id}`}>{t('公开说明', 'Public note')}</label><input id={`close-reason-${poll.id}`} bind:value={reason} maxlength="300" /></details>
      <div class="gm-vote-controls"><p>{poll.voted.length ? t('结束后公开计票，玩家将不能再更改选择。', 'Closing reveals the tally and locks all choices.') : t('尚无人投票，结束后不会产生决定。', 'No ballots yet. Closing will not produce a decision.')}</p><button class="btn primary" disabled={locked} type="submit">{poll.voted.length ? t('结束投票并计票', 'Close vote & reveal results') : t('结束空投票', 'Close empty vote')}</button></div>
    </form>
  {/if}
  {#if gm && poll.status === 'closed' && poll.tied.length && !poll.outcome}
    <details class="gm-details" open><summary><Scale size={15} />{t('主持人：处理平票', 'GM: resolve the tie')}</summary>
      <form onsubmit={(e) => { e.preventDefault(); command('resolve_tie', { pollId: poll.id, option: tieChoice, reason }); }}>
        <label for={`tie-${poll.id}`}>{t('根据讨论选择', 'Choose after discussion')}</label><select id={`tie-${poll.id}`} bind:value={tieChoice} required><option value="" disabled>{t('请选择', 'Select an option')}</option>{#each poll.options.filter(o => poll.tied.includes(o.id)) as o}<option value={o.id}>{o.label[$locale]}</option>{/each}</select>
        <label for={`reason-${poll.id}`}>{t('公开原因', 'Public reason')}</label><input id={`reason-${poll.id}`} bind:value={reason} required maxlength="300" placeholder={t('例如：全组讨论后同意，离线成员本轮跳过', 'For example: agreed after discussion; offline members pass this round')} />
        <button class="btn secondary" disabled={locked} type="submit">{t('记录裁决', 'Record decision')}</button>
      </form>
    </details>
  {/if}
  {#if poll.closeReason && !['restarted', 'archive-restored'].includes(poll.closeReason)}<p class="field-hint">{t('主持说明：', 'GM note: ')}{poll.closeReason}</p>{/if}
</section>
