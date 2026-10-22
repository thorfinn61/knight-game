import { networkInterfaces } from 'node:os';

/** Interfaces virtuelles (conteneurs, machines virtuelles) qu'un autre PC ne peut pas joindre. */
const VIRTUAL_INTERFACE = /^(docker|virbr|br-|veth|vmnet|vboxnet|lo)/;

/** Adresses IPv4 de cette machine sur le réseau local, à donner à un autre joueur. */
export function lanHosts(): string[] {
  const hosts: string[] = [];
  for (const [name, entries] of Object.entries(networkInterfaces())) {
    if (VIRTUAL_INTERFACE.test(name)) continue;
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) hosts.push(entry.address);
    }
  }
  return hosts;
}
