import axios from 'axios';
import { Telegraf } from 'telegraf';
import web3, { PublicKey } from '@solana/web3.js';
import { Metaplex } from '@metaplex-foundation/js';
import dotenv from 'dotenv';
import fs from 'fs';
import util from 'util'
dotenv.config();

const token_address = process.env.TOKEN_ADDRESS;
// console.log("token_address===============================", token_address)

const tgToken = '7308017784:AAHCiHj48NLms-Y6iQ_nMUFD165jRT0BhcA'
const rpcURL =
  'https://mainnet.helius-rpc.com/?api-key=351a75c0-adba-4e26-b066-a2e062cde11f'

const bot = new Telegraf(tgToken, { handlerTimeout: 9_000_000 })

const cmcURL = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest`
const coinmarketcap_key = '24d06be6-dbcc-4bd3-bf24-c4f156546917'

const WSOL = 'So11111111111111111111111111111111111111112'

const MIN = 0
const MAX = 5

const options = {
  method: 'GET',
  headers: {
    'x-chain': 'solana',
    'X-API-KEY': '061eef71caa947a3b82c8dbda8bbdf63'
  }
}

function checkValidate(address) {
  // Check validation of address
  try {
    // Check Solana wallet validation.
    let pubKey = new web3.PublicKey(address)

    web3.PublicKey.isOnCurve(pubKey.toBuffer())

    return true
  } catch {
    return false
  }
}

async function runScanning(address) {
  // Get transaction of Solana chains
  console.log('waiting......')
  // ======================get sol price=====================================
  const options1 = {
    method: 'GET',
    headers: { 'X-API-KEY': '061eef71caa947a3b82c8dbda8bbdf63' }
  }
  let solPrice = 0
  await fetch(
    'https://public-api.birdeye.so/defi/price?address=So11111111111111111111111111111111111111112',
    options1
  )
    .then(response => response.json())
    .then(response => {

      solPrice = response.data.value;
      console.log("solprice=================", solPrice);
    })
    .catch(err => console.error(err))


  // =========================================================================
  let pubKey = new web3.PublicKey(address)
  let connection = new web3.Connection(rpcURL)

  let latestSigns = await connection.getSignaturesForAddress(pubKey)

  // Get latest 24 hours transactions
  const now = Math.round(new Date().getTime() / 1000)
  const before = now - 24 * 3600
  //   console.log('time', now, before)

  latestSigns = latestSigns.filter(
    each => each.blockTime && each.blockTime >= before
  )

  // Return only signature id
  let latestTxn1000 = latestSigns.map((each) => {
    // console.log(each)
    return each.signature
  })

  let latestTxns = latestTxn1000

  //let latestTxns = latestTxn1000.slice(MIN, MAX)

  let replyText = ' --------------- analysis transactions ------------------ \n'
  let replyArr = []
  let emoji = '',
    plus = ''

  let totalSolDiff = 0
  let totalWSolDiff = 0
  let totalSolDiffPrice = 0
  let totalWSolDiffPrice = 0

  for (let each_signature of latestTxns) {
    // console.log("**************************");
    let detailed = await connection.getParsedTransaction(each_signature, {
      maxSupportedTransactionVersion: 0
    })

    // console.log(detailed, "= Detailed ==");

    // Calculate SOL differences
    let preBalances = detailed && detailed.meta ? detailed.meta.preBalances : []
    let postBalances = detailed && detailed.meta ? detailed.meta.postBalances : []

    let amountPreBalances = 0
    let loop = 0
    for (loop of preBalances) {
      amountPreBalances += loop
    }
    let amountPostBalances = 0
    for (loop of postBalances) {
      amountPostBalances += loop
    }

    const solDiff = (amountPostBalances - amountPreBalances) / 10 ** 9

    plus = ''
    emoji = ''

    if (solDiff > 0) {
      let plus = '+'
      emoji = '  🔵'
    } else if (solDiff < 0) {
      emoji = '  🔴'
    }

    totalSolDiff += solDiff

    replyText += '----- \n'
    replyText += 'Native SOL : ' + plus + solDiff + emoji + '\n'

    // Calculate SPL_Token differences
    let preTokenBalances = detailed.meta.preTokenBalances.map(item => {
      return item
    })

    let postTokenBalances = detailed.meta.postTokenBalances.map(item => {
      return item
    })

    let lengthDiff = postTokenBalances.length - preTokenBalances.length
    let eachArr = []
    let postloop = 0,
      preloop = 0
    if (lengthDiff >= 0) {
      for (postloop = 0; postloop < postTokenBalances.length; postloop++) {
        accountIndex = postTokenBalances[postloop].accountIndex
        // console.log(accountIndex, "postAccountIndex");
        let containIndex = 0
        let tokenDiff = 0
        for (preloop = 0; preloop < preTokenBalances.length; preloop++) {
          if (accountIndex == preTokenBalances[preloop].accountIndex) {
            containIndex = 1
            tokenDiff =
              postTokenBalances[postloop].uiTokenAmount.uiAmount -
              preTokenBalances[preloop].uiTokenAmount.uiAmount
            break
          }
        }
        if (containIndex == 0) {
          tokenDiff = postTokenBalances[postloop].uiTokenAmount.uiAmount
        }

        // console.log(tokenDiff, " = tokenDiff");
        if (tokenDiff != 0) {
          let pubKey1 = new web3.PublicKey(postTokenBalances[postloop].mint)
          let metaplexProvider = Metaplex.make(connection)

          // ==============================get token price==================================
          let price = 0
          await fetch(
            `https://public-api.birdeye.so/public/history_price?address=${pubKey1}&address_type=token&time_from=${before}&time_to=${now}`,
            options
          )
            .then(response => response.json())
            .then(response => {
              priceJson = response.data?.items
              price = priceJson[0].value
            })
            .catch(err => console.error(err))

          // ===============================================================================
          let metadataAccount = metaplexProvider
            .nfts()
            .pdas()
            .metadata({ mint: pubKey1 })

          let metadataAccountInfo = await connection.getAccountInfo(
            metadataAccount
          )

          let tokenInfo = {}
          if (metadataAccountInfo) {
            tokenInfo = await metaplexProvider
              .nfts()
              .findByMint({ mintAddress: pubKey1 })
          } else {
            tokenInfo = {
              symbol: postTokenBalances[postloop].mint,
              name: postTokenBalances[postloop].mint,
              decimals: postTokenBalances[postloop].uiTokenAmount.decimals
            }
          }
          emoji = ''
          plus = ''
          if (tokenDiff > 0) {
            plus = '+'
            emoji = '  🔵'
          } else if (tokenDiff < 0) {
            emoji = '  🔴'
          } else {
            emoji = ''
          }

          if (postTokenBalances[postloop].mint == WSOL) {
            totalWSolDiff += tokenDiff
            totalWSolDiffPrice += Number(tokenDiff * price).toFixed(8)
          }
          //   =========================================================================
          replyText +=
            tokenInfo.symbol +
            ' : ' +
            plus +
            tokenDiff +
            emoji +
            ' pnl: ' +
            tokenDiff * price +
            ' $' +
            '\n'
          const eachObj = {
            [tokenInfo.symbol]: tokenDiff * price,
            'balance change': tokenDiff
          }
          eachArr.push(eachObj)
        }
      }
    } else {
      for (preloop = 0; preloop < preTokenBalances.length; preloop++) {
        accountIndex = preTokenBalances[preloop].accountIndex
        let containIndex = 0
        let tokenDiff = 0
        for (postloop = 0; postloop < preTokenBalances.length; postloop++) {
          if (accountIndex == preTokenBalances[postloop].accountIndex) {
            containIndex = 1
            tokenDiff =
              postTokenBalances[postloop].uiTokenAmount.uiAmount -
              preTokenBalances[preloop].uiTokenAmount.uiAmount
            break
          }
        }
        if (containIndex == 0) {
          tokenDiff = 0 - preTokenBalances[preloop].uiTokenAmount.uiAmount
        }

        if (tokenDiff != 0) {
          let pubKey1 = new web3.PublicKey(preTokenBalances[preloop].mint)
          let metaplexProvider = Metaplex.make(connection)
          // ==============================get token price==================================
          let price = 0
          await fetch(
            `https://public-api.birdeye.so/public/history_price?address=${pubKey1}&address_type=token&time_from=${before}&time_to=${now}`,
            options
          )
            .then(response => response.json())
            .then(response => {
              priceJson = response.data?.items
              price = priceJson[0].value
            })
            .catch(err => console.error(err))

          // ===============================================================================

          let metadataAccount = metaplexProvider
            .nfts()
            .pdas()
            .metadata({ mint: pubKey1 })

          let metadataAccountInfo = await connection.getAccountInfo(
            metadataAccount
          )

          let tokenInfo = {}
          if (metadataAccountInfo) {
            tokenInfo = await metaplexProvider
              .nfts()
              .findByMint({ mintAddress: pubKey1 })
          } else {
            tokenInfo = {
              symbol: preTokenBalances[preloop].mint,
              name: preTokenBalances[preloop].mint,
              decimals: preTokenBalances[preloop].uiTokenAmount.decimals
            }
          }
          emoji = ''
          plus = ''
          if (tokenDiff > 0) {
            plus = '+'
            emoji = '  🔵'
          } else if (tokenDiff < 0) {
            emoji = '  🔴'
          } else {
            emoji = ''
          }

          if (preTokenBalances[preloop].mint == WSOL) {
            totalWSolDiff += tokenDiff
            totalWSolDiffPrice += Number(tokenDiff * price).toFixed(8)
          }

          replyText +=
            tokenInfo.symbol +
            ' : ' +
            plus +
            tokenDiff +
            emoji +
            ' pnl: ' +
            tokenDiff * price +
            ' $' +
            '\n'
          const eachObj = {
            [tokenInfo.symbol]: tokenDiff * price,
            'balance change': tokenDiff
          }
          eachArr.push(eachObj)
        }
      }
    }

    replyArr.push(eachArr)
  }
  const newArr = replyArr.flat()

  const totalSolPrice = Number(totalSolDiff * solPrice).toFixed

  // ======================================================================
  const result = {}
  newArr.forEach(obj => {
    const key = Object.keys(obj)[0]
    const value = obj[key]

    if (result[key]) {
      result[key] += value
    } else {
      result[key] = value
    }
  })

  const groupedArray = Object.keys(result).map(key => ({ [key]: result[key] }))
  // Convert result to array of objects
  // =======================return text=================================
  let returnText = ' --------------PNL groupby token ----------------- \n'
  let totalPrice = 0
  groupedArray.forEach(obj => {
    const key = Object.keys(obj)[0]
    const value = obj[key].toFixed(8)
    // totalPrice += value.toFixed(8)
    const balance = Object.keys(obj)[1]

    if (value > 0) {
      returnText += `${key} : +${value} $  🔵\n`
    } else {
      returnText += `${key} :  ${value} $  🔴\n`
    }
    totalPrice += Number(value)
  })
  totalPrice = totalPrice.toFixed(8)
  // returnText += '**** Total PNL ****  \n\n'
  returnText += `PNL price: ${totalPrice} $ \n`
  // ===================================================================
  // replyText += '\n **** Total ****  \n\n'
  // if (totalSolDiff > 0) {
  //   replyText +=
  //     'Native Sol : + ' +
  //     totalSolDiff +
  //     ' price:' +
  //     totalSolPrice +
  //     '  😍😍😍 \n\n'
  // } else if (totalSolDiff < 0) {
  //   replyText +=
  //     'Native Sol : ' +
  //     totalSolDiff +
  //     ' price:' +
  //     totalSolPrice +
  //     '  😡😡😡 \n\n'
  // } else {
  //   replyText += 'Native Sol : 0 \n\n'
  // }

  // if (totalWSolDiff > 0) {
  //   replyText +=
  //     'Wrapped Sol : + ' +
  //     totalWSolDiff +
  //     ' price:' +
  //     totalWSolDiffPrice +
  //     '  😍😍😍 \n\n'
  // } else if (totalWSolDiff < 0) {
  //   replyText +=
  //     'Wrapped Sol : ' +
  //     totalWSolDiff +
  //     ' price:' +
  //     totalWSolDiffPrice +
  //     '  😡😡😡 \n\n'
  // } else {
  //   replyText += 'Wrapped Sol : 0 \n\n'
  // }

  replyText +=
    // 'Total PNL = ' + Number(totalWSolDiffPrice) + Number(totalSolPrice) + '\n'
    'Total PNL = ' + Number(totalPrice) + ' $' + '\n'

  replyText += '------------ END ♥♥♥------------- \n'
  console.log('-----------finished!--------------- \n')
  console.log(returnText + replyText)
  return returnText + replyText
  // return returnText
}
// const url = `https://mainnet.helius-rpc.com/?api-key=351a75c0-adba-4e26-b066-a2e062cde11f`;


// async function get_token_largest_accounts(token_mint_address) {
//   const url = "https://mainnet.helius-rpc.com/?api-key=351a75c0-adba-4e26-b066-a2e062cde11f";
//   const headers = { "Content-Type": "application/json" };
//   const data = {
//     "jsonrpc": "2.0",
//     "id": 1,
//     "method": "getTokenLargestAccounts",
//     "params": [
//       token_mint_address
//     ]
//   };

//   try {
//     const response = await fetch(url, {
//       method: 'POST',
//       headers: headers,
//       body: JSON.stringify(data)
//     });

//     if (response.status === 200) {
//       const responseData = await response.json();
//       console.log("Largest token accounts:", responseData);
//     } else {
//       console.log(`Error: Failed to fetch data with status code ${response.status}`);
//     }
//   } catch (error) {
//     console.error('Error:', error);
//   }

//   const connection = new web3.Connection(rpcURL);
//   connection.getTokenLargestAccounts(new PublicKey(token_mint_address)).then(ret => {
//     console.log(ret.value);
//     console.log(ret.value.length);
//   }).catch(error => {
//     console.log(error);
//   });
// }

// get_token_largest_accounts(token_address);


const findHolders = async () => {
  let page = 1;
  let allOwners = new Set();

  while (true) {
    const response = await fetch(rpcURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "getTokenAccounts",
        id: "helius-test",
        params: {
          page: page,
          limit: 10,
          displayOptions: {},
          mint: token_address,
        },
      }),
    });
    const data = await response.json();

    data.wallets?.result?.token_accounts.sort((item1, item2) => {
      if (item1.amount > item2.amount) { return 1; }
      else if (item1.amount == item2.amount) { return 0; }
      else { return -1; }
    })

    console.log("---------------------------data-------------------", data)
    if (!data.result || data.result.token_accounts.length === 0 || page == 11) {
      console.log(`No more results. Total pages: ${page - 1}`);

      break;
    }

    console.log("wallets", util.inspect(data, { showHidden: false, depth: null, colors: true }))

    data.result.token_accounts.forEach((account) =>
      allOwners.add(account.owner)
    );
    page++;
  }


  fs.writeFileSync(
    "output.json",
    JSON.stringify(Array.from(allOwners), null, 2)


  );
};

findHolders();

let response = await runScanning("B4Nv5FjjnDdr5p84xcKBrGTZ7t94bnftnQkpMncUSsj2");
bot.start(ctx => ctx.reply('🙌🙌 Welcome To Solana PNL Bot 😁😁'))

bot.on('text', async ctx => {
  ctx.reply("here")
  let validate = checkValidate(ctx.message.text)
  if (validate) {
    let response = await runScanning(ctx.message.text)
    await ctx.reply(response)
    // runScanning(ctx.message.text);
  } else {
    await ctx.reply('ERR: This is not Solana wallet')
  }
})

bot.launch()

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

// runScanning("");
