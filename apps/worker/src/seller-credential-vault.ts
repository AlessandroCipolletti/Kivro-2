import { AsyncEntry } from '@napi-rs/keyring';
import { z } from 'zod';
import type { SellerCredentialVault } from '../../../packages/application/src/provider-broker.js';

const reference=z.string().regex(/^seller:[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/);
export class SellerCredentialError extends Error{
  constructor(readonly code:'MISSING'|'UNAVAILABLE'|'INVALID_REFERENCE'|'INVALID_SECRET'){
    super(code);this.name='SellerCredentialError';
  }
}
export interface SellerCredentialEntry{
  getSecret():Promise<Uint8Array|null|undefined>;
  setSecret(value:Uint8Array):Promise<void>;
}

/** Seller secrets stay in the OS vault. The cloud, job input and health API see
 * only a boolean, never bytes or the private keychain address. */
export class KeychainSellerCredentialVault implements SellerCredentialVault{
  constructor(private readonly deviceId:string,
    private readonly makeEntry:(name:string)=>SellerCredentialEntry=(name)=>
      new AsyncEntry('io.kivro.worker.seller.v1',name,
        {linux:{store:'secret-service'}})){
    z.uuid().parse(deviceId);
  }
  private entry(raw:string):SellerCredentialEntry{
    const parsed=reference.safeParse(raw);
    if(!parsed.success)throw new SellerCredentialError('INVALID_REFERENCE');
    try{return this.makeEntry(`${this.deviceId}:${parsed.data}`);}
    catch{throw new SellerCredentialError('UNAVAILABLE');}
  }
  async exists(ref:string):Promise<boolean>{
    let secret:Uint8Array|null|undefined;
    try{secret=await this.entry(ref).getSecret();
      return !!secret&&secret.byteLength>0&&secret.byteLength<=8192;}
    catch(error){if(error instanceof SellerCredentialError)throw error;
      throw new SellerCredentialError('UNAVAILABLE');}
    finally{secret?.fill(0);}
  }
  async resolve(ref:string):Promise<string>{
    let secret:Uint8Array|null|undefined;
    try{
      secret=await this.entry(ref).getSecret();
      if(!secret)throw new SellerCredentialError('MISSING');
      if(secret.byteLength<1||secret.byteLength>8192)
        throw new SellerCredentialError('INVALID_SECRET');
      return Buffer.from(secret).toString('utf8');
    }catch(error){if(error instanceof SellerCredentialError)throw error;
      throw new SellerCredentialError('UNAVAILABLE');}
    finally{secret?.fill(0);}
  }
  async put(ref:string,value:Uint8Array):Promise<void>{
    if(value.byteLength<1||value.byteLength>8192)
      throw new SellerCredentialError('INVALID_SECRET');
    try{await this.entry(ref).setSecret(value);}
    catch(error){if(error instanceof SellerCredentialError)throw error;
      throw new SellerCredentialError('UNAVAILABLE');}
  }
}
