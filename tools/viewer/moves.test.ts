import { describe, expect, it } from 'vitest';
import { parseStates } from '../mugen/states';
import { extractMoves, parseCommandList } from './moves';

const CMD = `
[Command]
name = "QCF_x"
command = ~D, DF, F, x
time = 20

[Command]
name = "x"
command = x
time = 1

[Command]
name = "holddown"
command = /$D

[Defaults]
command.time = 12

[Command]
name = "FF"
command = F, F

[Statedef -1]

[State -1, Hadou]
type = ChangeState
value = 1000
triggerall = command = "QCF_x"
trigger1 = statetype != A
trigger1 = ctrl

[State -1, Run]
type = ChangeState
value = ifelse(pos y >= 0, 100, 105)
trigger1 = command = "FF"

[State -1, Crouch Punch]
type = ChangeState
value = 400
triggerall = command = "x"
triggerall = command = "holddown"
trigger1 = statetype = C
trigger1 = ctrl

[State -1, Stand Punch]
type = ChangeState
value = 200
triggerall = command = "x"
triggerall = command != "holddown"
trigger1 = statetype = S
trigger1 = ctrl
trigger2 = stateno = 200 && movecontact

[State -1, AI only]
type = ChangeState
value = 1000
trigger1 = var(59) = 1

[Statedef 200]
anim = 200

[State 200, combo]
type = ChangeState
value = 210
trigger1 = command = "x"

[Statedef 210]
anim = 210

[Statedef 400]
anim = 400

[Statedef 1000]
anim = 1000+var(11)

[State 1000, end]
type = ChangeState
value = 1001
trigger1 = animtime = 0

[Statedef 1001]
anim = 1001

[Statedef 100]
anim = 100
`;

const ANIMS = new Set([0, 11, 100, 105, 200, 210, 400, 1000, 1001]);

describe('parseCommandList', () => {
  it('keeps every input; [Defaults] applies to every command without a time', () => {
    const c = parseCommandList(CMD);
    expect(c['qcf_x']).toEqual([{ name: 'QCF_x', input: '~D, DF, F, x', time: 20 }]);
    expect(c['holddown']![0]!.time).toBe(12);
    expect(c['ff']![0]!.time).toBe(12);
  });
});

describe('extractMoves', () => {
  const { moves } = extractMoves(CMD, parseStates([CMD]), (id) => ANIMS.has(id));
  const byName = (n: string) => moves.find((m) => m.name === n)!;

  it('names moves after their controller and reads stance and command conditions', () => {
    expect(moves.map((m) => m.name)).toEqual(['Hadou', 'Run', 'Crouch Punch', 'Stand Punch']);
    expect(byName('Hadou').conditions).toEqual([{ cmd: ['qcf_x'], notCmd: [], stance: ['S', 'C'] }]);
    expect(byName('Crouch Punch').conditions[0]).toEqual({ cmd: ['x', 'holddown'], notCmd: [], stance: ['C'] });
    expect(byName('Stand Punch').conditions).toEqual([{ cmd: ['x'], notCmd: ['holddown'], stance: ['S'] }]);
  });

  it('classifies moves', () => {
    expect(byName('Hadou').kind).toBe('special');
    expect(byName('Stand Punch').kind).toBe('normal');
    expect(byName('Run').kind).toBe('movement');
  });

  it('follows automatic state changes but not button combos or variable indices', () => {
    expect(byName('Hadou').anims).toEqual([1000, 1001]);
    expect(byName('Stand Punch').anims).toEqual([200]);
    expect(byName('Run').state).toBe(100);
  });
});
