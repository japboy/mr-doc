'use strict';
import File from 'fs';
import Path from 'path';
import _ from 'lodash';
import Compiler from './compiler';
import Parser from './parser';
import Markdown from 'markdown-it';
import mkdirp from 'mkdirp';
import Theme from './theme';
/**  
 * The main class that creates beautiful documentations.  
 * @class Doc  * @extend Compiler  
 */
class Doc extends Compiler {
  // Initialize the compiler   
  // and pass the parser.   
  constructor(options) {
      super(new Parser(options));
      // Set the locals stack       
      this.locals = [];
    }
    /** 
     * Generates the documentations.      
     */
  generate() {
      // Compute all symboles       
      var allSymbols = this.files.reduce(function(m, a) {
        m = m.concat(a.symbols || []);
        return m;
      }, []);
      // Set package
      var pkg = this.options.package;
      // Set readme
      var readme = pkg && pkg.readme,
        readMeFile = Path.resolve(process.cwd(), this.options.readme ||
          (pkg && pkg.readmeFileName) || 'README.md');
      if (!readme && File.existsSync(readMeFile)) {
        readme = File.readFileSync(readMeFile).toString();
      } else {
        console.warn('Mr. Doc [warn]: No README.md file found at ' + readMeFile);
      }
      if (!readme) {
        console.warn('Mr. Doc [warn]: Empty README.md ' + readMeFile);
        readme = '';
      }
      var md = new Markdown();
      md = md.render.bind(md);
      // Get readme data       
      this.files.unshift({
        name: 'Main',
        targetName: 'index.html',
        readme: md(readme),
        dox: [],
        symbols: []
      });
      // Set title       
      var title = this.options.name ? this.options.name : pkg ? pkg.name : 'No title';
      // Set description       
      var description = pkg && pkg.description ? pkg.description : '';
      // Set URLs       
      var url = {
        github: pkg && pkg.homepage ?
          pkg.homepage.indexOf('github') > -1 ?
          pkg.homepage : false : false,
        npm: pkg && pkg.name ? 'https://npmjs.com/package/' + pkg.name : false,
        homepage: pkg && pkg.homepage ? pkg.homepage.indexOf('github') === -1 ? pkg.homepage : false : false
      };
      // Make sure the folder structure in target mirrors source       
      var folders = [];
      this.files.forEach(file => {
        var folder = file.targetName
          .substr(0, file.targetName.lastIndexOf(Path.sep));
        if ((folder !== '') && (folders.indexOf(folder) === -1)) {
          folders.push(folder);
          mkdirp.sync(this.options.output + '/' + folder);
        }
      });
      // Set each files relName in relation        
      // to where this file is in the directory tree       
      this.files.forEach(file => {
        file.targets = this.getTargets(file);
      });
      this.files.forEach((file) => {
        // Set locals         
        this.locals.push(_.assign({}, file, {
          project: {
            title, description, url
          },
          allSymbols: allSymbols,
          files: this.files,
          current: {
            name: file.name
          },
          file: {
            targets: file.targets
          }
        }));
      });
      // Install theme       
      (new Theme(this.options)).install().then((result) => {
        var {
          theme
        } = result;
        if (theme) {
          console.info('Mr. Doc [info]: Installed theme: ' + theme);
        }
        _.forEach(this.files, (file, index) => {
          // Set template           
          this.setTemplate(result.template);
          // Compile the template           
          let compiled = this.compile(this.locals[index]);
          // Write files           
          mkdirp(this.options.output + '/', error => {
            if (error) return;
            else File.writeFileSync(Path.join(this.options.output, file.targetName), compiled);
          });
        });
      }, console.error);
    }
    /**       
     * Return the targets for the specified file      
     * @private      
     * @param  {Object} file The file to generate      
     * @return {Object}      The iterator      
     */
  getTargets(file) {
    return _.map(this.files, (f) => {
      // Count how deep the current file is in relation to base       
      var count = file.name.split('/');
      count = count === null ? 0 : count.length - 1;
      // relName is equal to targetName at the base dir       
      f.relative = {
        name: f.targetName,
        path: ''
      };
      // For each directory in depth of current file        
      // add a ../ to the relative filename of this link       
      while (count > 0) {
        f.relative.name = '../' + f.relative.name;
        f.relative.path += '../';
        count--;
      }
      // Set the target for each folder        
      // to support nested directories       
      // and allow asset files to access the dir       
      return {
        name: f.targetName,
        path: f.relative.path + f.targetName,
        file: {
          name: f.name
        },
        relative: f.relative
      };
    });
  }
}
export default function(options) {
  return new Doc(options);
}