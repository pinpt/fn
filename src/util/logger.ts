import { format } from 'util';

/**
 * Logger is a convenience class for logging
 */
export default class Logger {
    static debug(msg:string, ...args: any[]):void {
        const m = format(msg, args);        
        console.log('[DEBUG]', m);
    }
    static info(msg:string, ...args: any[]):void {
        const m = format(msg, args);        
        console.log('[INFO]', m);
    }
    static error(msg:string, ...args: any[]):void {
        const m = format(msg, args);        
        console.log('[ERROR]', m);
    }
    static warning(msg:string, ...args: any[]):void {
        const m = format(msg, args);        
        console.log('[WARN]', m);
    }
}