using Microsoft.Owin;
using Owin;

[assembly: OwinStartupAttribute(typeof(ScorecardMerge2.Startup))]
namespace ScorecardMerge2
{
    public partial class Startup
    {
        public void Configuration(IAppBuilder app)
        {
            ConfigureAuth(app);
        }
    }
}
